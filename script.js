document.addEventListener('DOMContentLoaded', () => {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const convertBtn = document.getElementById('convertBtn');
    const downloadSection = document.getElementById('downloadSection');
    const progress = document.querySelector('.progress');
    let convertedFileUrl = null;

    // Drag and drop handlers
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        handleFile(file);
    });

    // File input change handler
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        handleFile(file);
    });

    // Convert button click handler
    convertBtn.addEventListener('click', convertFile);

    function handleFile(file) {
        const validExtensions = ['doc', 'docx'];
        const validTypes = [
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];

        if (!file) return;

        const extension = file.name.split('.').pop().toLowerCase();
        const isValidType = validTypes.includes(file.type) || validExtensions.includes(extension);

        if (!isValidType) {
            alert('Please upload a valid Word document (.doc or .docx)');
            return;
        }

        if (file.size > 25 * 1024 * 1024) {
            alert('File size exceeds 25MB limit');
            return;
        }

        uploadArea.style.display = 'none';
        fileInfo.style.display = 'block';
        fileName.textContent = file.name;
    }

    async function convertFile() {
        if (!fileInput.files[0]) return;
        
        try {
            convertBtn.disabled = true;
            convertBtn.textContent = 'Converting...';
            progress.style.width = '100%';

            const formData = new FormData();
            formData.append('file', fileInput.files[0]);

            const response = await axios.post('/.netlify/functions/convert', formData, {
                responseType: 'blob',
                headers: {
                    'File-Name': encodeURIComponent(fileInput.files[0].name)
                }
            });

            convertedFileUrl = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
            
            downloadSection.style.display = 'block';
            convertBtn.style.display = 'none';
            document.getElementById('downloadLink').href = convertedFileUrl;
            document.getElementById('downloadLink').download = fileInput.files[0].name.replace(/\.[^/.]+$/, '') + '.pdf';

        } catch (error) {
            const errorMessage = error.response?.data?.message || 
                              error.response?.data?.error || 
                              error.message;
            alert(`Conversion failed: ${errorMessage}`);
        } finally {
            progress.style.width = '0%';
            convertBtn.disabled = false;
            convertBtn.textContent = 'Convert to PDF';
        }
    }

    // Reset functionality
    downloadSection.addEventListener('click', () => {
        uploadArea.style.display = 'block';
        fileInfo.style.display = 'none';
        downloadSection.style.display = 'none';
        convertBtn.style.display = 'block';
        fileInput.value = '';
        if (convertedFileUrl) URL.revokeObjectURL(convertedFileUrl);
    });
});
