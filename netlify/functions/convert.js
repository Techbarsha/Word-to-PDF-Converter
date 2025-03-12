const axios = require('axios');
const FormData = require('form-data');

exports.handler = async (event) => {
    try {
        // Debugging logs
        console.log('Incoming request headers:', event.headers);
        console.log('File size:', event.body.length);

        // Validate API Key
        if (!process.env.CLOUDCONVERT_API_KEY) {
            throw new Error('CloudConvert API key not configured');
        }

        // Validate file presence
        if (!event.body || event.body.length === 0) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "No file uploaded" })
            };
        }

        // Parse file data
        const fileBuffer = Buffer.from(event.body, 'binary');
        const fileName = event.headers['x-file-name'] || 'document.docx';

        // Create CloudConvert job
        const jobResponse = await axios.post(
            'https://api.cloudconvert.com/v2/jobs',
            {
                tasks: {
                    'import-1': {
                        operation: 'import/upload'
                    },
                    'task-1': {
                        operation: 'convert',
                        input: ['import-1'],
                        output_format: 'pdf',
                        engine: 'office'
                    },
                    'export-1': {
                        operation: 'export/url',
                        input: ['task-1']
                    }
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.CLOUDCONVERT_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // Handle job creation errors
        if (jobResponse.status !== 200) {
            throw new Error('Failed to create conversion job');
        }

        // Get upload URL
        const importTask = jobResponse.data.data.tasks.find(t => t.name === 'import-1');
        if (!importTask) {
            throw new Error('Could not find import task in CloudConvert response');
        }
        const uploadUrl = importTask.result.url;

        // Upload file directly to CloudConvert
        await axios.put(uploadUrl, fileBuffer, {
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Length': fileBuffer.length
            }
        });

        // Monitor conversion status
        let status;
        let exportUrl;
        const startTime = Date.now();
        const jobId = jobResponse.data.data.id;

        do {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const statusResponse = await axios.get(
                `https://api.cloudconvert.com/v2/jobs/${jobId}`,
                {
                    headers: {
                        Authorization: `Bearer ${process.env.CLOUDCONVERT_API_KEY}`
                    }
                }
            );

            status = statusResponse.data.data.status;
            
            // Handle timeout
            if (Date.now() - startTime > 25000) {
                throw new Error('Conversion timeout after 25 seconds');
            }

            if (status === 'finished') {
                const exportTask = statusResponse.data.data.tasks.find(t => t.name === 'export-1');
                exportUrl = exportTask?.result?.files[0]?.url;
            }
        } while (status === 'processing' || status === 'waiting');

        // Handle failed conversion
        if (status !== 'finished' || !exportUrl) {
            throw new Error('Conversion failed with status: ' + status);
        }

        // Download converted PDF
        const pdfResponse = await axios.get(exportUrl, {
            responseType: 'arraybuffer'
        });

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${fileName.replace(/\.[^/.]+$/, "")}.pdf"`
            },
            body: Buffer.from(pdfResponse.data).toString('base64'),
            isBase64Encoded: true
        };

    } catch (error) {
        console.error('Conversion error:', error);
        return {
            statusCode: error.response?.status || 500,
            body: JSON.stringify({
                error: error.message,
                details: error.response?.data || error.stack
            })
        };
    }
};
