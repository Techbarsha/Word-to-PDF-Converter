exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));
    try {
        console.log('API Key:', process.env.CLOUDCONVERT_API_KEY ? 'Exists' : 'Missing');
        // ... existing code
    } catch (error) {
        console.error('Full error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: error.message,
                stack: error.stack
            })
        };
    }
};
