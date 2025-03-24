document.addEventListener('DOMContentLoaded', () => {
    // Função para carregar alunos
    async function fetchAlunos() {
        try {
            const token = localStorage.getItem('token');
            console.log("Token:", token);

            const response = await fetch('/alunos-mestrado', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Erro ao carregar os alunos.');
            }

            const alunos = await response.json();
            console.log('Alunos carregados:', alunos);

            const selectElement = document.getElementById('aluno');
            selectElement.innerHTML = ''; // Limpar as opções existentes

            if (alunos && Array.isArray(alunos) && alunos.length > 0) {
                alunos.forEach(aluno => {
                    const option = document.createElement('option');
                    option.textContent = aluno.nome;
                    option.setAttribute('data-id', aluno.id_aluno); // Armazenar id_aluno no atributo data-id
                    option.setAttribute('data-nome', aluno.nome); // Armazenar nome do aluno também
                    selectElement.appendChild(option);
                });
            } else {
                console.log('Nenhum aluno encontrado.');
            }
        } catch (error) {
            console.error('Erro ao carregar os alunos:', error.message);
        }
    }

    async function fetchProfessores() {
        const token = localStorage.getItem('token');
        try {
            const response = await fetch('/professores', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                throw new Error('Erro ao carregar os professores.');
            }

            const professores = await response.json();
            console.log('Professores carregados:', professores);

            const selectElement = document.getElementById('orientador');
            selectElement.innerHTML = '';
            if (professores && Array.isArray(professores) && professores.length > 0) {
                professores.forEach(professor => {
                    const option = document.createElement('option');
                    option.textContent = professor.nome;
                    option.setAttribute('data-id', professor.id_professor); 
                    option.setAttribute('data-nome', professor.nome); 
                    selectElement.appendChild(option);
                });
            } else {
                console.log('Nenhum professor encontrado.');
            }
        } catch (error) {
            console.error('Erro ao carregar os professores:', error.message);
        }
    }


    const form = document.getElementById('registerThesisForm');
    if (form) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();

            const formData = new FormData(form);

            const alunoSelect = document.getElementById('aluno');
            const alunoId = alunoSelect.options[alunoSelect.selectedIndex].getAttribute('data-id');
            const alunoNome = alunoSelect.options[alunoSelect.selectedIndex].getAttribute('data-nome');
            formData.append('id_aluno', alunoId); 
            formData.append('nome_aluno', alunoNome); 
            const orientadorSelect = document.getElementById('orientador');
            const orientadorId = orientadorSelect.options[orientadorSelect.selectedIndex].getAttribute('data-id');
            const orientadorNome = orientadorSelect.options[orientadorSelect.selectedIndex].getAttribute('data-nome');
            formData.append('id_orientador', orientadorId); 
            formData.append('nome_orientador', orientadorNome);
            
            formData.forEach((value, key) => {
                console.log(key, value);
            });

            try {
                const response = await fetch('/registar-tese', {
                    method: 'POST',
                    body: formData,
                });

                const result = await response.json();

                if (response.ok) {
                    alert('Tese registrada com sucesso!');
                } else {
                    alert(`Erro: ${result.message}`);
                }
            } catch (error) {
                console.error('Erro ao registrar tese:', error);
            }
        });
    } else {
        console.error('Formulário não encontrado.');
    }

    fetchAlunos();
    fetchProfessores();

    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', function () {
            localStorage.removeItem("token"); 
            window.location.href = "/login";
        });
    }
});
