const axios = require('axios');
const FormData = require('form-data');

exports.handler = async (event) => {
    try {
        // Verify API Key
        if (!process.env.CLOUDCONVERT_API_KEY) {
            throw new Error('CloudConvert API key not configured');
        }

        // Parse incoming file
        const fileBuffer = Buffer.from(event.body, 'binary');
        const fileName = event.headers['file-name'] || 'document.docx';

        // Create CloudConvert Job
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

        // Upload file to CloudConvert
        const uploadUrl = jobResponse.data.data.tasks.find(t => t.name === 'import-1').result.url;
        const formData = new FormData();
        formData.append('file', fileBuffer, {
            filename: fileName,
            contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });

        await axios.put(uploadUrl, formData, {
            headers: formData.getHeaders()
        });

        // Monitor conversion status
        let statusCheck;
        let exportUrl;
        const startTime = Date.now();
        
        do {
            await new Promise(resolve => setTimeout(resolve, 2000));
            statusCheck = await axios.get(
                `https://api.cloudconvert.com/v2/jobs/${jobResponse.data.data.id}`,
                {
                    headers: {
                        Authorization: `Bearer ${process.env.CLOUDCONVERT_API_KEY}`
                    }
                }
            );

            if (Date.now() - startTime > 30000) {
                throw new Error('Conversion timeout');
            }

            status = statusCheck.data.data.status;
            if (status === 'finished') {
                exportUrl = statusCheck.data.data.tasks.find(t => t.name === 'export-1').result.files[0].url;
            }
        } while (status === 'processing' || status === 'waiting');

        // Return converted PDF
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
                details: error.response?.data
            })
        };
    }
};
