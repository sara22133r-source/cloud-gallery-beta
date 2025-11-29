// ====================================================================
// CONFIGURACIÓN: REEMPLAZA ESTOS VALORES
// ====================================================================
const SUPABASE_URL = '[TU_SUPABASE_URL_AQUÍ]'; // Ej: https://pgekhqqjmlzozxohspdi.supabase.co
const SUPABASE_ANON_KEY = '[TU_SUPABASE_ANON_KEY_AQUÍ]'; // Clave pública 'anon'
const DISCORD_WEBHOOK_URL = '[TU_WEBHOOK_URL_AQUÍ]'; // URL para las alertas de registro
const MAX_FILE_SIZE_MB = 30; // Límite de 30 MB por archivo
// ====================================================================

// Inicializa el cliente de Supabase
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Referencias a elementos del DOM
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const authForm = document.getElementById('auth-form');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const toggleAuthMode = document.getElementById('toggle-auth-mode');
const authStatusMessage = document.getElementById('auth-status-message');
const userEmailDisplay = document.getElementById('user-email-display');
const logoutBtn = document.getElementById('logout-btn');
const fileUploadInput = document.getElementById('file-upload-input');
const uploadFilesBtn = document.getElementById('upload-files-btn');
const uploadStatus = document.getElementById('upload-status');
const galleryElement = document.getElementById('photo-gallery');
const emptyGalleryMsg = document.getElementById('empty-gallery-msg');
const uploadProgressContainer = document.getElementById('upload-progress-container');
const uploadProgressBar = document.getElementById('upload-progress-bar');

let isRegisterMode = false;

// ====================================================================
// 🧠 LÓGICA DE AUTENTICACIÓN
// ====================================================================

// Función para cambiar entre Login y Registro
toggleAuthMode.addEventListener('click', () => {
    isRegisterMode = !isRegisterMode;
    if (isRegisterMode) {
        authSubmitBtn.textContent = 'Registrar Cuenta';
        toggleAuthMode.textContent = '¿Ya tienes cuenta? Inicia Sesión.';
        authStatusMessage.classList.add('hidden');
    } else {
        authSubmitBtn.textContent = 'Iniciar Sesión';
        toggleAuthMode.textContent = '¿No tienes cuenta? Regístrate aquí.';
        authStatusMessage.classList.add('hidden');
    }
});

// Función para mostrar mensajes de error/éxito
function displayAuthMessage(message, isError = true) {
    authStatusMessage.textContent = message;
    authStatusMessage.className = isError ? 'text-center text-red-500 mb-4' : 'text-center text-green-500 mb-4';
    authStatusMessage.classList.remove('hidden');
}

// Handler de Login/Registro
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = authEmail.value;
    const password = authPassword.value;

    authSubmitBtn.disabled = true;
    authSubmitBtn.textContent = 'Cargando...';

    let result;
    if (isRegisterMode) {
        // 1. REGISTRO
        result = await supabase.auth.signUp({ email, password });
        if (result.data.user) {
            await enviarAlertaDiscord(email);
            displayAuthMessage("Registro exitoso. ¡Revisa tu email para confirmar!", false);
        }
    } else {
        // 2. LOGIN
        result = await supabase.auth.signInWithPassword({ email, password });
    }

    authSubmitBtn.disabled = false;
    authSubmitBtn.textContent = isRegisterMode ? 'Registrar Cuenta' : 'Iniciar Sesión';
    
    if (result.error) {
        displayAuthMessage(result.error.message);
    } else if (result.data.user) {
        // Si el login fue exitoso, cambia a la pantalla de la aplicación
        checkUserSession();
    }
});

// Botón de Cerrar Sesión
logoutBtn.addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
        window.location.reload(); // Recarga para volver a la pantalla de login
    }
});

// ====================================================================
// 📢 ALERTA EN DISCORD (Paso 4)
// ====================================================================

async function enviarAlertaDiscord(email) {
    const message = {
        username: "Cloud Gallery Notifier (Nuevo Registro)",
        embeds: [{
            title: "🎉 Nuevo Usuario Registrado en Cloud Gallery Beta",
            color: 3066993, // Verde
            fields: [{ name: "Correo Electrónico", value: email, inline: false }],
            timestamp: new Date().toISOString()
        }]
    };

    try {
        await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(message)
        });
    } catch (error) {
        console.error("Fallo al enviar la alerta a Discord:", error);
    }
}

// ====================================================================
// 📸 LÓGICA DE SUBIDA DE ARCHIVOS (Paso 2.1)
// ====================================================================

let filesToUpload = [];

// Maneja la selección de archivos
fileUploadInput.addEventListener('change', (e) => {
    filesToUpload = Array.from(e.target.files);
    uploadStatus.textContent = filesToUpload.length > 0 ? `${filesToUpload.length} archivo(s) seleccionado(s).` : '';
    uploadFilesBtn.disabled = filesToUpload.length === 0;
});

// Handler del botón de Subida
uploadFilesBtn.addEventListener('click', async () => {
    if (filesToUpload.length === 0) return;

    uploadFilesBtn.disabled = true;
    uploadFilesBtn.textContent = 'Subiendo...';
    uploadProgressContainer.classList.remove('hidden');

    let successCount = 0;
    
    for (const file of filesToUpload) {
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            uploadStatus.textContent = `Error: "${file.name}" excede el límite de ${MAX_FILE_SIZE_MB} MB.`;
            continue;
        }

        try {
            await subirArchivo(file
