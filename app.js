// ====================================================================
// CONFIGURACIÓN DE FIREBASE Y DISCORD
// ====================================================================
// Tus claves de configuración de Firebase (extraídas de la consola)
const firebaseConfig = {
    apiKey: "AIzaSyCHEFhtBaDx3AZmdOt7JcI5s-YvY12DpxSc",
    authDomain: "cloud-gallery-beta.firebaseapp.com",
    projectId: "cloud-gallery-beta",
    storageBucket: "cloud-gallery-beta.appspot.com", // Ajustado para el SDK
    messagingSenderId: "214624987874",
    appId: "1:214624987874:web:adce100fb19752ea870cbb"
};

const DISCORD_WEBHOOK_URL = '[https://discord.com/api/webhooks/1443618037294174220/cHXeoeQ9KzfGkKtUeVL-9AXk0o4ARszzBsEtkMm6xAVYgAMQdrSmNLP1K198X8HCgVSE]'; // URL para las alertas de registro
const MAX_FILE_SIZE_MB = 30;
// ====================================================================

// Inicialización de Firebase
const app = firebase.initializeApp(firebaseConfig);

// Obtener referencias a los servicios
const auth = firebase.auth();
const storage = firebase.storage();
const db = firebase.firestore();

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
const uploadProgressContainer = document.getElementById('upload-progress-container');
const uploadProgressBar = document.getElementById('upload-progress-bar');

let isRegisterMode = false;

// ====================================================================
// 🧠 LÓGICA DE AUTENTICACIÓN (FIREBASE)
// ====================================================================

toggleAuthMode.addEventListener('click', () => {
    isRegisterMode = !isRegisterMode;
    // ... (Lógica para cambiar texto sigue siendo la misma)
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

function displayAuthMessage(message, isError = true) {
    authStatusMessage.textContent = message;
    authStatusMessage.className = isError ? 'text-center text-red-500 mb-4' : 'text-center text-green-500 mb-4';
    authStatusMessage.classList.remove('hidden');
}

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = authEmail.value;
    const password = authPassword.value;

    authSubmitBtn.disabled = true;
    authSubmitBtn.textContent = 'Cargando...';

    try {
        if (isRegisterMode) {
            // 1. REGISTRO
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            await enviarAlertaDiscord(email);
            // Firebase requiere verificación de email, pero para la beta, mostramos éxito
            displayAuthMessage("Registro exitoso. ¡Ahora puedes iniciar sesión!", false);
            // Cambiamos a modo login para que el usuario intente iniciar sesión inmediatamente
            isRegisterMode = false;
            authSubmitBtn.textContent = 'Iniciar Sesión';
            toggleAuthMode.textContent = '¿No tienes cuenta? Regístrate aquí.';
        } else {
            // 2. LOGIN
            await auth.signInWithEmailAndPassword(email, password);
            // La función onAuthStateChanged se encarga de cambiar la pantalla
        }
    } catch (error) {
        let errorMessage = 'Error desconocido. Inténtalo de nuevo.';
        if (error.code) {
             // Mapeo de códigos de error comunes de Firebase
            errorMessage = error.message; 
        }
        displayAuthMessage(errorMessage);
    } finally {
        authSubmitBtn.disabled = false;
        if (!isRegisterMode) {
            authSubmitBtn.textContent = 'Iniciar Sesión';
        }
    }
});

logoutBtn.addEventListener('click', async () => {
    await auth.signOut();
});

// ====================================================================
// 📢 ALERTA EN DISCORD
// ====================================================================

async function enviarAlertaDiscord(email) {
    const message = {
        username: "Cloud Gallery Notifier (Nuevo Registro)",
        embeds: [{
            title: "🎉 Nuevo Usuario Registrado en Cloud Gallery Beta",
            color: 3066993,
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
        console.error("Fallo al enviar la alerta a Discord. Esto es un error de backend.", error);
    }
}

// ====================================================================
// 📸 LÓGICA DE SUBIDA DE ARCHIVOS (FIREBASE STORAGE Y FIRESTORE)
// ====================================================================

let filesToUpload = [];

fileUploadInput.addEventListener('change', (e) => {
    filesToUpload = Array.from(e.target.files);
    uploadStatus.textContent = filesToUpload.length > 0 ? `${filesToUpload.length} archivo(s) seleccionado(s).` : 'Seleccionar Fotos o Videos';
    uploadFilesBtn.disabled = filesToUpload.length === 0;
});

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
            await subirArchivo(file);
            successCount++;
        } catch (error) {
            console.error(`Fallo al subir ${file.name}:`, error);
        }

        // Actualizar barra de progreso
        const progress = (successCount / filesToUpload.length) * 100;
        uploadProgressBar.style.width = `${progress}%`;
    }

    // Resetear la interfaz
    uploadStatus.textContent = `Subida completa. ${successCount} de ${filesToUpload.length} archivos procesados.`;
    filesToUpload = [];
    fileUploadInput.value = '';
    uploadFilesBtn.disabled = true;
    uploadFilesBtn.textContent = 'Subir';
    uploadProgressContainer.classList.add('hidden');
    
    cargarGaleria(); // Recargar la galería después de subir
});


async function subirArchivo(file) {
    const userId = auth.currentUser.uid;
    // Usamos el prefijo 'archivos_usuarios/' para coincidir con la Regla de Seguridad
    const filePath = `archivos_usuarios/${userId}/${Date.now()}_${file.name}`; 
    
    // 1. Subir a Firebase Storage
    const storageRef = storage.ref().child(filePath);
    const uploadTask = storageRef.put(file);

    return new Promise((resolve, reject) => {
        uploadTask.on(
            'state_changed',
            (snapshot) => {
                // Puedes usar el snapshot.bytesTransferred / snapshot.totalBytes
                // si quieres mostrar el progreso de un solo archivo
            }, 
            (error) => {
                // Manejar errores de subida
                reject(error);
            },
            async () => {
                // Subida completada con éxito.
                try {
                    // 2. Obtener URL de descarga para almacenar en Firestore
                    const fileURL = await storageRef.getDownloadURL();
                    
                    // 3. Guardar metadatos en Firestore (BD)
                    await db.collection('archivos_subidos').add({
                        user_id: userId,
                        file_name: file.name,
                        file_url: fileURL, // Guardamos la URL para fácil visualización
                        file_size_mb: (file.size / 1024 / 1024).toFixed(2),
                        created_at: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    resolve();
                } catch (dbError) {
                    // Si falla la escritura en BD, borramos el archivo del Storage para limpiar
                    storageRef.delete().catch(console.error);
                    reject(dbError);
                }
            }
        );
    });
}

// ====================================================================
// 🖼️ VISUALIZACIÓN DE GALERÍA (FIREBASE FIRESTORE)
// ====================================================================

async function cargarGaleria() {
    const userId = auth.currentUser.uid;
    
    // 1. Consultar Firestore: buscar documentos donde user_id coincida con el usuario actual
    const snapshot = await db.collection('archivos_subidos')
                             .where('user_id', '==', userId)
                             .orderBy('created_at', 'desc')
                             .get();

    galleryElement.innerHTML = ''; 

    if (snapshot.empty) {
        galleryElement.innerHTML = `<p id="empty-gallery-msg" class="text-gray-500 col-span-5 text-center p-8">Sube tus primeros archivos para verlos aquí.</p>`;
        return;
    }

    snapshot.forEach(doc => {
        const file = doc.data();
        const fileURL = file.file_url;
            
        const isVideo = file.file_name.match(/\.(mp4|mov|avi|webm)$/i);

        const mediaHTML = isVideo ? 
            `<video src="${fileURL}" controls class="w-full h-40 object-cover rounded-lg"></video>` :
            `<img src="${fileURL}" alt="${file.file_name}" class="w-full h-40 object-cover rounded-lg">`;

        const element = document.createElement('div');
        element.className = 'gallery-item bg-gray-100 p-2 rounded-lg shadow-sm';
        
        const dateDisplay = file.created_at ? new Date(file.created_at.toDate()).toLocaleDateString() : 'N/A';

        element.innerHTML = `
            <div class="aspect-video">${mediaHTML}</div>
            <p class="text-xs font-medium truncate mt-2">${file.file_name}</p>
            <p class="text-xs text-gray-500">${file.file_size_mb} MB - ${dateDisplay}</p>
            <!-- El atributo download fuerza la descarga (Paso 2.3) -->
            <a href="${fileURL}" download="${file.file_name}" 
               class="inline-block w-full text-center mt-2 py-1 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 transition">
                Descargar
            </a>
        `;
        galleryElement.appendChild(element);
    });
}

// ====================================================================
// 🔄 GESTIÓN DE LA SESIÓN AL INICIAR LA PÁGINA
// ====================================================================

auth.onAuthStateChanged((user) => {
    if (user) {
        // Usuario logueado: Mostrar app
        authScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        userEmailDisplay.textContent = `Usuario: ${user.email}`;
        cargarGaleria();
    } else {
        // No logueado: Mostrar pantalla de login/registro
        authScreen.classList.remove('hidden');
        appScreen.classList.add('hidden');
    }
});
