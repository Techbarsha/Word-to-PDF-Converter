const axios = require('axios');
const FormData = require('form-data');

exports.handler = async (event) => {
    try {
        const API_KEY = process.env.CLOUDCONVERT_API_KEY;
        const file = event.body;
        
        // Create CloudConvert Job
        const jobResponse = await axios.post('https://api.cloudconvert.com/v2/jobs', {
            "tasks": {
                'import-1': {
                    "operation": "import/upload"
                },
                'task-1': {
                    "operation": "convert",
                    "input": ["import-1"],
                    "output_format": "pdf",
                    "engine": "office"
                },
                'export-1': {
                    "operation": "export/url",
                    "input": ["task-1"]
                }
            }
        }, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        // Get upload URL
        const uploadUrl = jobResponse.data.data.tasks.find(t => t.name === 'import-1').result.url;

        // Upload file
        const formData = new FormData();
        formData.append('file', Buffer.from(file, 'binary'), {
            filename: 'document.docx'
        });

        await axios.put(uploadUrl, formData, {
            headers: formData.getHeaders()
        });

        // Wait for conversion
        let status;
        let exportUrl;
        do {
            await new Promise(resolve => setTimeout(resolve, 1500));
            const statusResponse = await axios.get(`https://api.cloudconvert.com/v2/jobs/${jobResponse.data.data.id}`, {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`
                }
            });
            
            status = statusResponse.data.data.status;
            if (status === 'finished') {
                exportUrl = statusResponse.data.data.tasks.find(t => t.name === 'export-1').result.files[0].url;
            }
        } while (status === 'processing' || status === 'waiting');

        // Download PDF
        const pdfResponse = await axios.get(exportUrl, {
            responseType: 'arraybuffer'
        });

        return {
            statusCode: 200,
            body: Buffer.from(pdfResponse.data).toString('base64'),
            isBase64Encoded: true,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename="converted.pdf"'
            }
        };

    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
