async function loadTheses() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('Token não encontrado');
            const container = document.getElementById('card-container');
            container.innerHTML = '<p>Token de autenticação não encontrado.</p>';
            return;
        }

        const estadoFilter = document.getElementById('estadoFilter').value || null; // id_estado_tese
        const anoLetivoFilter = document.getElementById('anoLetivoFilter').value || null;
        const dataDefesaFilter = document.getElementById('dataDefesaFilter').value || null;

        console.log('Filtros:', { estadoTese: estadoFilter, anoLetivo: anoLetivoFilter, dataDefesa: dataDefesaFilter });

        // Enviar os filtros para a API
        const filters = {
            estadoTese: estadoFilter,
            anoLetivo: anoLetivoFilter,
            dataDefesa: dataDefesaFilter
        };

        const response = await fetch('/dashboard', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(filters)
        });

        if (!response.ok) {
            console.error('Erro na resposta:', response.statusText);
            const container = document.getElementById('card-container');
            container.innerHTML = `<p>Erro ao carregar os dados: ${response.statusText}</p>`;
            return;
        }

        const theses = await response.json();
        console.log('Teses recebidas:', theses);

        const propostasContainer = document.getElementById('propostas-container');
        const associadasContainer = document.getElementById('associadas-container');

        propostasContainer.innerHTML = '';
        associadasContainer.innerHTML = '';

        if (Array.isArray(theses) && theses.length > 0) {
            theses.sort((a, b) => new Date(a.data_defesa) - new Date(b.data_defesa));

            theses.forEach(thesis => {
                const card = document.createElement('div');
                card.className = 'card';

                let formattedDefesaDate = 'Não atribuída';
                if (thesis.data_defesa && new Date(thesis.data_defesa).getTime()) {
                    const defesaDate = new Date(thesis.data_defesa);
                    formattedDefesaDate = defesaDate.toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }

                card.innerHTML = `
                    <img src="../images/defesa_icon.png" alt="defesa_icon" class="card-image" />
                    <div>
                        <h3>Título: ${thesis.titulo_pt}</h3>
                        <p>Nome do Aluno: ${thesis.aluno_nome}</p>
                        <p>Mestrado: ${thesis.mestrado_nome} (${thesis.mestrado_sigla})</p>
                        <p>Data de defesa: ${formattedDefesaDate}</p>
                        <p>Estado: ${thesis.estado_descricao}</p>
                    </div>
                `;

                if (thesis.data_aceitacao === null) {
                    const acceptButton = document.createElement('button');
                    acceptButton.textContent = 'Aceitar';
                    acceptButton.className = 'accept-button';
                    acceptButton.addEventListener('click', (e) => {
                        e.stopPropagation();
                        acceptThesis(thesis.id_tese);
                    });

                    const rejectButton = document.createElement('button');
                    rejectButton.textContent = 'Rejeitar';
                    rejectButton.className = 'reject-button';
                    rejectButton.addEventListener('click', (e) => {
                        e.stopPropagation();
                        rejectThesis(thesis.id_tese);
                    });

                    card.appendChild(acceptButton);
                    card.appendChild(rejectButton);

                    propostasContainer.appendChild(card);
                } else {
                    associadasContainer.appendChild(card);

                    card.addEventListener('click', () => {
                        if (isCoordinator() || isProfessor()) {
                            window.location.href = `/tese/${thesis.id_tese}`;
                        } else {
                            openModal(thesis);
                        }
                    });
                }
            });
        } else {
            associadasContainer.innerHTML = '<p>Não há teses associadas.</p>';
        }
    } catch (error) {
        console.error('Erro ao carregar os dados:', error);
        const container = document.getElementById('card-container');
        container.innerHTML = '<p>Erro ao carregar os dados. Tente novamente mais tarde.</p>';
    }
}


async function loadFilterOptions() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('Token não encontrado');
            return;
        }

        const estadoResponse = await fetch('/estados-tese', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const estados = await estadoResponse.json();
        const estadoFilter = document.getElementById('estadoFilter');
        
        
        estados.forEach(estado => {
            const option = document.createElement('option');
            option.value = estado.id_estado_tese; 
            option.textContent = estado.descricao;  
            estadoFilter.appendChild(option);
        });
        const anoLetivoResponse = await fetch('/anos-letivos', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const anosLetivos = await anoLetivoResponse.json();
        const anoLetivoFilter = document.getElementById('anoLetivoFilter');
        anosLetivos.forEach(ano => {
            const option = document.createElement('option');
            option.value = ano.ano_letivo;
            option.textContent = ano.ano_letivo;
            anoLetivoFilter.appendChild(option);
        });

    } catch (error) {
        console.error('Erro ao carregar filtros:', error);
    }
}

function acceptThesis(thesisId) {
    console.log(`Aceitar tese com ID: ${thesisId}`);
    
    fetch(`/aceitar-tese/${thesisId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
    .then(response => {
        if (response.ok) {
            alert('Tese aceita com sucesso!');
            loadTheses(); 
        } else {
            alert('Erro ao aceitar tese');
        }
    })
    .catch(error => {
        console.error('Erro ao aceitar tese:', error);
    });
}

function rejectThesis(thesisId) {
    console.log(`Rejeitar tese com ID: ${thesisId}`);
    fetch(`/rejeitar-tese/${thesisId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
    .then(response => {
        if (response.ok) {
            alert('Tese rejeitada com sucesso!');
            loadTheses(); 
        } else {
            alert('Erro ao rejeitar tese');
        }
    })
    .catch(error => {
        console.error('Erro ao rejeitar tese:', error);
    });
}

function isCoordinator() {
    const token = localStorage.getItem('token');
    if (!token) return false;

    try {
        const decodedToken = JSON.parse(atob(token.split('.')[1]));
        return decodedToken.userType === 'coordenador_mestrado';
    } catch (error) {
        console.error('Erro ao decodificar o token:', error);
        return false;
    }
}

function isProfessor() {
    const token = localStorage.getItem('token');
    if (!token) return false;

    try {
        const decodedToken = JSON.parse(atob(token.split('.')[1]));
        return decodedToken.userType === 'professor';
    } catch (error) {
        console.error('Erro ao decodificar o token:', error);
        return false;
    }
}

function isAluno() {
    const token = localStorage.getItem('token');
    if (!token) return false;

    try {
        const decodedToken = JSON.parse(atob(token.split('.')[1]));
        return decodedToken.userType === 'aluno';
    } catch (error) {
        console.error('Erro ao decodificar o token:', error);
        return false;
    }
}

function openModal(thesis) {
    const modal = document.getElementById('modal');
    const modalBody = document.getElementById('modal-body');

    const defesaDate = new Date(thesis.data_defesa);
    const formattedDate = defesaDate.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    modalBody.innerHTML = `
        <h2>Detalhes da Tese</h2>
        <p><strong>Título:</strong> ${thesis.titulo_pt}</p>
        <p><strong>Nome do Aluno:</strong> ${thesis.aluno_nome}</p>
        <p><strong>Orientadores:</strong></p>
        <ul>
            ${thesis.orientadores_nomes && thesis.orientadores_nomes.length > 0 
                ? thesis.orientadores_nomes.map(orientador => `<li>${orientador}</li>`).join('') 
                : '<li>Não disponível</li>'}
        </ul>
        <p><strong>Mestrado:</strong> ${thesis.mestrado_nome} (${thesis.mestrado_sigla})</p>
        <p><strong>Data da Defesa:</strong> ${formattedDate}</p>
        <p><strong>Resumo:</strong> ${thesis.resumo || 'Não disponível'}</p>
        <p><strong>Estado:</strong> ${thesis.estado_descricao}</p>
        <p><strong>Nota:</strong> ${thesis.nota !== null ? thesis.nota : 'Não disponível'}</p>
    `;

    modal.style.display = 'block';

    const closeModalButton = document.getElementById('close-modal');
    closeModalButton.onclick = () => {
        modal.style.display = 'none';
    };

    window.onclick = event => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
}

document.addEventListener('DOMContentLoaded', function () {
    console.log('Página carregada, script será executado');
    
    loadTheses();
    loadFilterOptions();  // Carregar os filtros

    // Adiciona o evento de clique para o botão de aplicar filtros
    const applyFiltersButton = document.getElementById('applyFilters');
    if (applyFiltersButton) {
        applyFiltersButton.addEventListener('click', function () {
            loadTheses(); // Recarregar as teses com os filtros aplicados
        });
    }

    const resetFiltersButton = document.getElementById('resetFilters');
    if (resetFiltersButton) {
        resetFiltersButton.addEventListener('click', function () {
            document.getElementById('estadoFilter').value = '';
            document.getElementById('anoLetivoFilter').value = '';
            document.getElementById('dataDefesaFilter').value = '';
            loadTheses();
        });
    }

    const registerThesisLink = document.getElementById('registerThesisLink');
    if (isCoordinator() && registerThesisLink) {
        registerThesisLink.style.display = 'inline'; 
    }

    const filtersContainer = document.getElementById('filters-container');
    if (!isProfessor() && !isCoordinator()) {
        filtersContainer.style.display = 'none'; // Esconde os filtros para usuários não autorizados
    }

    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', function () {
            localStorage.removeItem("token"); 
            window.location.href = "/login";
        });
    }
});

