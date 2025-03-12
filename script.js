document.addEventListener('DOMContentLoaded', () => {
    // Previous variable declarations
    let convertedFileUrl = null;

    async function convertFile() {
        if (!fileInput.files[0]) return;
        
        convertBtn.disabled = true;
        convertBtn.textContent = 'Converting...';
        progress.style.width = '100%';

        try {
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);

            const response = await axios.post('/.netlify/functions/convert', formData, {
                responseType: 'blob'
            });

            convertedFileUrl = URL.createObjectURL(new Blob([response.data], {type: 'application/pdf'}));
            
            downloadSection.style.display = 'block';
            convertBtn.style.display = 'none';
            document.getElementById('downloadLink').href = convertedFileUrl;
            
        } catch (error) {
            alert(`Conversion failed: ${error.response?.data?.message || error.message}`);
        } finally {
            progress.style.width = '0%';
            convertBtn.disabled = false;
            convertBtn.textContent = 'Convert to PDF';
        }
    }

    // Previous event listeners and other functions
});