document.addEventListener('DOMContentLoaded', function () {
    // Carregamento inicial
    loadThesisDetails();
    
    // Logout
    document.getElementById('logoutButton').addEventListener('click', function () {
        localStorage.removeItem('token');
        window.location.href = '/login';
    });

    // Modal de constituição do júri
    const juryModal = document.getElementById('juryModal');
    const closeButton = juryModal.querySelector('.close');
    const constituteJuryButton = document.getElementById('constitute-jury-button');
    const checkbox = document.getElementById('arguente-checkbox');
    const selectContainer = document.getElementById('arguente-select-container');
    const inputContainer = document.getElementById('arguente-input-container');
    const submitButton = document.getElementById('submit-button');

    constituteJuryButton.style.display = 'none';
    juryModal.style.display = 'none';
    selectContainer.style.display = 'none';
    inputContainer.style.display = 'none';

    constituteJuryButton.addEventListener('click', () => {
        juryModal.style.display = 'flex';
        loadProfessorsAndInstitutions();
    });

    closeButton.addEventListener('click', () => {
        juryModal.style.display = 'none';
    });

    checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
            selectContainer.style.display = 'block';
            inputContainer.style.display = 'none';
        } else {
            selectContainer.style.display = 'none';
            inputContainer.style.display = 'block';
        }
    });

    window.addEventListener('click', (event) => {
        if (event.target === juryModal) {
            juryModal.style.display = 'none';
        }
    });

    submitButton.addEventListener('click', async function (event) {
        event.preventDefault();
        await submitJuryForm();
        window.location.reload();
    });

    // Submissão de data
    const submitDateButton = document.getElementById('submit-date-button');
    const datetimepicker = document.getElementById('datetimepicker');
    const testsButton = document.getElementById('tests-button');

    submitDateButton.style.display = 'none';
    testsButton.style.display = 'none';
    datetimepicker.style.display = 'none';

    flatpickr(datetimepicker, {
        enableTime: true,
        dateFormat: "Y-m-d H:i",
        time_24hr: true,
        minuteIncrement: 1,
    });

    submitDateButton.addEventListener('click', function () {
        datetimepicker.style.display = 'inline-block';
        datetimepicker.focus();
        submitDate(datetimepicker.value);
        window.location.reload();
    });

    testsButton.addEventListener('click', async function (event) {
        event.preventDefault();
        await submitTests();
    });

    // Modal de envio de documentos
    const modalConfig = {
        modal: document.getElementById('documentModal'),
        form: document.getElementById('document-form'),
        fileInput: document.getElementById('document-upload'),
        selectType: document.getElementById('document-type'),
        closeButton: document.querySelector('#documentModal .close'),
        submitButton: document.getElementById('submit-document-button'),
        openButton: document.getElementById('openModalButton'), // Botão para abrir o modal
    };

    function toggleModal(show) {
        if (show) {
            fetchDocumentTypes();
        }
        modalConfig.modal.style.display = show ? 'flex' : 'none';
    }

    modalConfig.openButton?.addEventListener('click', () => toggleModal(true));

    modalConfig.closeButton?.addEventListener('click', () => toggleModal(false));

    window.addEventListener('click', (event) => {
        if (event.target === modalConfig.modal) toggleModal(false);
    });

    modalConfig.form.addEventListener('submit', (event) => {
        event.preventDefault();

        const file = modalConfig.fileInput?.files[0];
        const documentType = modalConfig.selectType.value;

        if (!documentType) {
            alert('Por favor, selecione o tipo de documento.');
            return;
        }

        if (!file) {
            alert('Por favor, selecione um ficheiro para submeter.');
            return;
        }

        uploadDocument(file, documentType);

        alert('Documento submetido com sucesso!');
        toggleModal(false);
    });

    async function fetchDocumentTypes() {
        try {
            const response = await fetch('/tipo-documento-assinado', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
    
            if (!response.ok) {
                throw new Error('Erro ao buscar tipos de documento.');
            }
    
            const data = await response.json();
    
            modalConfig.selectType.innerHTML = '<option value="">Selecione o tipo de documento...</option>';
            data.forEach(item => {
                const option = document.createElement('option');
                option.value = item.id_tipo_documento;
                option.textContent = item.descricao;
                modalConfig.selectType.appendChild(option);
            });
        } catch (error) {
            console.error('Erro ao carregar tipos de documento:', error);
            alert('Não foi possível carregar os tipos de documento.');
        }
    }

});



async function loadThesisDetails() {
    const thesisId = window.location.pathname.split('/').pop();

    if (isNaN(thesisId)) {
        document.getElementById('thesis-detail-container').innerHTML = '<p>ID de tese inválido.</p>';
        return;
    }

    const container = document.getElementById('thesis-detail-container');
    container.innerHTML = '<p>Carregando os detalhes da tese...</p>';

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            container.innerHTML = '<p>Token de autenticação não encontrado. Faça login novamente.</p>';
            return;
        }

        const decodedToken = JSON.parse(atob(token.split('.')[1]));

        const response = await fetch(`/tese/${thesisId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorResponse = await response.text();
            container.innerHTML = `<p>Erro ao carregar os detalhes da tese: ${errorResponse}</p>`;
            return;
        }

        const thesis = await response.json();

        if (!thesis || !thesis.titulo_pt) {
            container.innerHTML = '<p>Detalhes da tese não encontrados.</p>';
            return;
        }

        container.innerHTML = ` 
            <h3>Título: ${thesis.titulo_pt || 'Não disponível'}</h3>
            <p><strong>Nome do Aluno:</strong> ${thesis.aluno_nome || 'Não disponível'}</p>
            <p><strong>Orientadores:</strong></p>
            <ul>
                ${Array.isArray(thesis.orientadores_nomes) && thesis.orientadores_nomes.length > 0
                    ? [...new Set(thesis.orientadores_nomes)].map(orientador => `<li>${orientador}</li>`).join('') 
                    : '<li>Não atribuído</li>'}
            </ul>
            <p><strong>Mestrado:</strong> ${thesis.mestrado_nome || 'Não disponível'} (${thesis.mestrado_sigla || 'N/A'})</p>
            <p><strong>Data da Defesa:</strong> ${thesis.data_defesa ? new Date(thesis.data_defesa).toLocaleString('pt-BR') : 'Não atribuída'}</p>
            <p><strong>Resumo:</strong> ${thesis.resumo || 'Não disponível'}</p>
            <p><strong>Estado da Tese:</strong> ${thesis.estado_tese_descricao || 'Não disponível'}</p>
            <p><strong>Nota:</strong> ${thesis.nota !== null ? thesis.nota : 'Não disponível'}</p>
            <p><strong>Estado do Júri:</strong> ${thesis.estado_juri_descricao || 'Não disponível'}</p>

        `;

        const estadoTese = thesis.estado_tese_descricao;
        const estadoJuri = thesis.estado_juri_descricao;

        const constituteJuryButton = document.getElementById('constitute-jury-button');
        const datePicker = document.getElementById('datetimepicker');
        const submitDateButton = document.getElementById('submit-date-button');
        const testsButton = document.getElementById('tests-button');

       
        if (estadoTese === 'Entregue' && estadoJuri === null && decodedToken.userType === 'coordenador_mestrado') {
            constituteJuryButton.style.display = 'block';
        } else {
            constituteJuryButton.style.display = 'none';
        }

        if (
            estadoTese === 'Entregue' &&
            estadoJuri === 'Aceite' &&
            decodedToken.userType === 'coordenador_mestrado' &&
            !thesis.data_defesa
        ) {
            console.log("Exibindo datetimepicker e botão de envio.");
            datePicker.style.display = 'inline-block';
            submitDateButton.style.display = 'inline-block';
        } else {
            console.log("Ocultando datetimepicker e botão de envio.");
            datePicker.style.display = 'none';
            submitDateButton.style.display = 'none';
        }
        
        


        if (
            estadoTese === 'Agendada' &&
            estadoJuri === 'Aceite' &&
            thesis.data_defesa && 
            (decodedToken.userType === 'coordenador_mestrado' || decodedToken.userType === 'professor')
        ) {
            const dataAtual = new Date();
            const dataDefesa = new Date(thesis.data_defesa);
        
            if (!isNaN(dataDefesa.getTime())) {
                if (dataAtual >= dataDefesa) {
                    testsButton.style.display = 'block';
                } else {
                    testsButton.style.display = 'none';
                }
            } else {
                console.error("Erro: data_defesa inválida.");
            }
        }
        
        
        
        loadJury(thesis, decodedToken);
        loadDocuments();

    } catch (error) {
        container.innerHTML = '<p>Erro ao carregar os dados da tese. Tente novamente mais tarde.</p>';
    }
}


function addConstituteJuryButton() {
    const button = document.getElementById('constitute-jury-button');
    if (button) {
        button.style.display = 'block';
        button.addEventListener('click', () => {
            console.log('Botão "Constituir Júri" clicado!');
        });
    }
}


async function loadJury(thesis, decodedToken) {
    const container = document.getElementById('jury-container');
    if (!container) return;

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            container.innerHTML = '<p>Token de autenticação não encontrado. Faça login novamente.</p>';
            return;
        }

        if (!thesis || !thesis.jurados || !Array.isArray(thesis.jurados)) {
            container.innerHTML = `<p>Dados da tese estão inválidos ou incompletos.</p>`;
            return;
        }

        const jury = thesis.jurados;
        const estadoJuriDescricao = thesis.estado_juri_descricao || 'Estado do júri não disponível';

        if (thesis.estado_juri_descricao === null) {
            
        } else if (jury.length > 0) {
            container.innerHTML = `
                <h3>Constituição do Júri</h3>
                <ul>
                    ${jury.map(member => `
                        <li>
                            <strong>${member.professor_nome}</strong>
                            <p><strong>Cargo:</strong> ${member.cargo_descricao}</p>
                            ${member.observacoes ? `<p><strong>Observações:</strong> ${member.observacoes}</p>` : ''}
                            ${member.nota ? `<p><strong>Nota:</strong> ${member.nota}</p>` : ''}
                        </li>
                    `).join('')}
                </ul>
            `;

            const allMembersHaveDetails = jury.every(
                member => member?.observacoes?.trim() && member?.nota != null
            );

            if (allMembersHaveDetails && thesis.estado_tese_descricao === 'Agendada') {
                const submitTestsButton = document.getElementById('tests-button');
                submitTestsButton.style.display = 'none';
                if (decodedToken.userType === 'coordenador_mestrado') {
                    
                    
                    const thesisId = window.location.pathname.split('/').pop();
                    fetch(`/tese/${thesisId}/gerar-atas-provas`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${localStorage.getItem('token')}`
                        },
                    })
                        .then(response => {
                            if (!response.ok) {
                                throw new Error(`Erro ao gerar atas: ${response.statusText}`);
                            }
                            return response.json();
                        })
                        .then(data => {
                            console.log('Atas geradas com sucesso:', data);
                        })
                        .catch(error => {
                            console.error('Erro ao consumir a rota /gerar-atas-provas:', error);
                        });
                }
               
            }
            
        } else {
            container.innerHTML = `<p>O júri ainda não foi constituído ou os dados não estão disponíveis.</p>`;
        }
    } catch (error) {
        console.error('Erro ao carregar a constituição do júri:', error);
        container.innerHTML = '<p>Erro ao carregar a constituição do júri. Tente novamente mais tarde.</p>';
    }
}


async function loadDocuments() {
    const thesisId = window.location.pathname.split('/').pop();
    const container = document.getElementById('documentos-container');
    container.innerHTML = '<p>Carregando documentos...</p>';

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('Token não encontrado');
            container.innerHTML = '<p>Token de autenticação não encontrado. Faça login novamente.</p>';
            return;
        }

        const response = await fetch(`/tese/${thesisId}/documentos`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            container.innerHTML = '<p>Não há documentos associados a esta tese.</p>';
            return;
        }

        const documentos = await response.json();

        container.innerHTML = ` 
            <h3>Documentos:</h3>
            <ul>
                ${documentos.map(doc => `
                    <li>
                        <img src="../images/document-icon.png" alt="document-icon" style="width: 30px; height: 30px; margin-right: 10px; vertical-align: -10px;">
                        <a href="javascript:void(0);" onclick="downloadDocument(${thesisId}, '${doc.titulo}', '${doc.extensao}')">
                            ${doc.titulo} ${doc.extensao}
                        </a>
                    </li>
                `).join('')}
            </ul>
        `;
    } catch (error) {
        console.error('Erro ao carregar documentos:', error);
        container.innerHTML = '<p>Erro ao carregar os documentos. Tente novamente mais tarde.</p>';
    }
}

function downloadDocument(thesisId, documentTitle, documentExtension) {
    const token = localStorage.getItem('token');
    if (!token) {
        console.error('Token não encontrado');
        return;
    }

    const downloadUrl = `/tese/${thesisId}/documentos/download/${documentTitle}/${documentExtension}`;

    fetch(downloadUrl, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (response.ok) {
            return response.blob();
        } else {
            console.error('Erro ao baixar o documento.');
            alert('Erro ao tentar fazer download do documento.');
        }
    })
    .then(blob => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${documentTitle}.${documentExtension}`;
        link.click();
    })
    .catch(error => {
        console.error('Erro ao baixar documento:', error);
    });
}


async function loadProfessorsAndInstitutions() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('Token de autenticação não encontrado.');
            return;
        }

        const professorsResponse = await fetch('/professores', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!professorsResponse.ok) {
            console.error('Erro ao carregar os professores.');
            return;
        }

        const professors = await professorsResponse.json();
        console.log('Professores:', professors); 

        const presidenteSelect = document.getElementById('presidente');
        const vogalSelect = document.getElementById('vogal1');
        const arguenteSelect = document.getElementById('arguente');  

        presidenteSelect.innerHTML = '';
        vogalSelect.innerHTML = '';
        arguenteSelect.innerHTML = '';

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Selecione...';

        presidenteSelect.appendChild(defaultOption.cloneNode(true));
        vogalSelect.appendChild(defaultOption.cloneNode(true));
        arguenteSelect.appendChild(defaultOption.cloneNode(true));

        professors.forEach(professor => {
            const option = document.createElement('option');
            option.value = professor.id;
            option.textContent = professor.nome;

            presidenteSelect.appendChild(option.cloneNode(true));
            vogalSelect.appendChild(option.cloneNode(true));

            arguenteSelect.appendChild(option.cloneNode(true));
        });

        const institutionsResponse = await fetch('/instituicoes', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!institutionsResponse.ok) {
            console.error('Erro ao carregar as instituições.');
            return;
        }

        const institutions = await institutionsResponse.json();
        console.log('Instituições:', institutions);  
        const institutionSelectContainer = document.getElementById('arguente-instituicao');

        institutionSelectContainer.innerHTML = '';

        const institutionSelect = document.createElement('select');
        institutionSelect.id = 'arguente-instituicao';
        institutionSelect.name = 'arguente-instituicao';

        const institutionDefaultOption = document.createElement('option');
        institutionDefaultOption.value = '';
        institutionDefaultOption.textContent = 'Selecione...';
        institutionSelect.appendChild(institutionDefaultOption);

        institutions.forEach(institution => {
            const option = document.createElement('option');
            option.value = institution.id_instituicao;
            option.textContent = institution.sigla;
            institutionSelect.appendChild(option);
        });

        institutionSelectContainer.appendChild(institutionSelect);

    } catch (error) {
        console.error('Erro ao carregar professores e instituições:', error);
    }
}

async function submitJuryForm() {
    const thesisId = window.location.pathname.split('/').pop();
    const presidente = document.getElementById('presidente').options[document.getElementById('presidente').selectedIndex].text;
    const vogal = document.getElementById('vogal1').options[document.getElementById('vogal1').selectedIndex].text;
    const arguente = document.getElementById('arguente').value;
    let nomeArguente = '';

    if (arguente) {
        nomeArguente = document.getElementById('arguente').options[document.getElementById('arguente').selectedIndex].text;
    } else {
        nomeArguente = document.getElementById('arguente-nome').value;
    }


    const curriculumArguente = document.getElementById('arguente-curriculum').value || ''; 
    const instituicaoArguente = document.getElementById('arguente-instituicao').value || ''; 
    const emailArguente = document.getElementById('arguente-email').value || ''; 
    const doutoradoArguente = document.getElementById('arguente-doutorado').checked; 

    const requestBody = {
        nome_presidente: presidente,  
        nome_vogal: vogal,          
        nome_arguente: nomeArguente,    
        curriculum_arguente: curriculumArguente,
        instituicao_arguente: instituicaoArguente,
        email_arguente : emailArguente,
        doutorado_arguente: doutoradoArguente
    };

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/tese/${thesisId}/proposta_juri`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(requestBody)
        });

        if (response.ok) {
            const result = await response.json();
            const pdfBufferBase64 = result.pdfBuffer;
            const tituloDocumento = result.tituloDocumento;

            console.log('Documento gerado com sucesso:', tituloDocumento);

            const byteCharacters = atob(pdfBufferBase64); 
            const byteArrays = [];

            for (let offset = 0; offset < byteCharacters.length; offset++) {
                const byteArray = byteCharacters.charCodeAt(offset);
                byteArrays.push(byteArray);
            }

            const byteArray = new Uint8Array(byteArrays);
            const blob = new Blob([byteArray], { type: 'application/pdf' });

            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = tituloDocumento;
            link.click();

            console.log('Download do documento iniciado!');
        } else {
            console.error('Erro ao gerar o documento');
        }
    } catch (error) {
        console.error('Erro na requisição', error);
    }
}



async function submitDate(date) {
    const thesisId = window.location.pathname.split('/').pop(); 

    if (!thesisId) {
        alert('ID da tese não encontrado no URL.');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            alert('Token de autenticação não encontrado. Faça login novamente.');
            return;
        }

        const requestBody = {
            data_entrega: date
        };

        const response = await fetch(`/tese/${thesisId}/registar-data-defesa`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(requestBody)
        });

        if (response.ok) {
            const result = await response.json();
            alert('Data de defesa registada com sucesso!');
        } else {    
            const error = await response.text();    
            alert(`Erro ao registar data de defesa: ${error}`);
        }
    } catch (error) {
        console.error('Erro ao registar data de defesa:', error);
    }  
}


async function submitTests() {
    const thesisId = window.location.pathname.split('/').pop(); 
    window.location.href = `/tese/${thesisId}/provas-parecer`;
}

async function uploadDocument(file, documentType) {
    const thesisId = window.location.pathname.split('/').pop();

    if (!thesisId) {
        alert('ID da tese não encontrado na URL.');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            alert('Token de autenticação não encontrado. Faça login novamente.');
            return;
        }

        const formData = new FormData();
        formData.append('file', file); 
        formData.append('id_tipo_documento', documentType);
        
        const response = await fetch(`/tese/${thesisId}/upload-documento`, { 
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erro ao enviar o documento.');
        }

        const result = await response.json();
        alert(result.message || 'Documento enviado com sucesso.');
        console.log('Resultado:', result);
    } catch (error) {
        console.error('Erro ao enviar documento:', error);
        alert('Erro ao enviar o documento: ' + error.message);
    }
}
