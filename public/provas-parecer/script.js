document.addEventListener("DOMContentLoaded", () => {
    // Botão Voltar
    const voltarButton = document.getElementById("back-button");
    voltarButton.addEventListener("click", () => {
        window.history.back();
    });

    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', function () {
            localStorage.removeItem("token"); 
            window.location.href = "/login";
        });
    }
    
    const submitButton = document.querySelector("#formulario button[type='button']");
    submitButton.addEventListener("click", async () => {
        const observacoes = document.querySelector("#observacoes").value;
        const nota = document.querySelector("#nota").value;

        const pathParts = window.location.pathname.split('/');
        const idTese = parseInt(pathParts[2], 10);

        const token = localStorage.getItem("token"); 

        if (!observacoes || !nota) {
            alert("Por favor, preencha todos os campos do formulário.");
            return;
        }

        if (!token) {
            alert("Token de autenticação não encontrado. Por favor, faça login novamente.");
            return;
        }

        try {
            const response = await fetch(`/tese/${idTese}/registar-provas-parecer`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({ observacoes, nota }),
            });

            if (response.ok) {
                const data = await response.json();
                alert(data.message || "Provas submetidas com sucesso!");
            } else {
                const errorData = await response.json();
                alert(errorData.message || "Erro ao submeter as provas.");
            }
        } catch (error) {
            console.error("Erro ao submeter provas:", error);
            alert("Ocorreu um erro ao submeter as provas. Por favor, tente novamente mais tarde.");
        }
    });
});
