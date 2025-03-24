document.querySelector('.info-btn').addEventListener('click', function(event) {
    event.preventDefault();
    document.getElementById('cookieModal').style.display = 'block';
});

document.querySelector('.close').addEventListener('click', function() {
    document.getElementById('cookieModal').style.display = 'none';
});

document.querySelector('.ok-button').addEventListener('click', function() {
    document.getElementById('cookieModal').style.display = 'none';
});

window.onclick = function(event) {
    if (event.target === document.getElementById('cookieModal')) {
        document.getElementById('cookieModal').style.display = 'none';
    }
};

document.querySelector('form').addEventListener('submit', async function (event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);

    const email = formData.get('email');
    const password = formData.get('password');

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        const result = await response.json();

        if (response.ok) {
            localStorage.setItem('token', result.token); 
            alert('Login bem-sucedido!');
            window.location.href = '/dashboard';
        } else {
            console.error(result.error);
            alert(result.error || 'Erro desconhecido');
        }
    } catch (err) {
        console.error('Erro ao enviar login:', err);
        alert('Erro ao conectar ao servidor. Tente novamente mais tarde.');
    }
});
