const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const fs = require('fs');

// URLs y textos configurables
const MAKE_WEBHOOK_URL = 'https://hook.eu2.make.com/0j4ffyr9p1iethmqu5jgxfcibyqpm5m7';
const MAKE_RESPONSE_URL = 'https://hook.eu2.make.com/q2mvvt09qkb24p9246fdbe2erpugxxil';
const CONTACTO_REAL = 'Puedes llamarnos directamente al 📞 680493055 si prefieres hablar con una persona real.';
const HORARIO_TEXTO = 'Nuestro horario es de lunes a viernes de 10:00 a 20:00, sábados de 10:00 a 14:00, y cerramos domingos.';
const DIRECCION_TEXTO = '📍 Blade Razor Barber está ubicada en Carrer de Còrsega, 562, L\'Eixample, 08025 Barcelona.';

const usuarios = {};

const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'blade-barber-bot' }),
    puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    console.log('Escanea este QR para vincular el bot.');
});

client.on('ready', () => {
    console.log('✅ Bot de WhatsApp listo y funcionando 24/7 online en Railway.');
});

client.on('message', async msg => {
    const chatId = msg.from;
    const mensaje = msg.body.trim().toLowerCase();

    if (!usuarios[chatId]) {
        usuarios[chatId] = { estado: 'clasificando', datos: {}, memoria: {} };
    }

    const usuario = usuarios[chatId];

    if (mensaje.includes('menu')) {
        usuarios[chatId] = { estado: 'clasificando', datos: {}, memoria: {} };
        await client.sendMessage(chatId, '🔄 Conversación reiniciada. ¿Quieres agendar una cita, consultar una reserva o preguntar algo?');
        return;
    }

    if (mensaje.includes('horario') || mensaje.includes('abierto') || mensaje.includes('abiertos')) {
        await client.sendMessage(chatId, '📅 ' + HORARIO_TEXTO);
        return;
    }

    if (mensaje.includes('direccion') || mensaje.includes('ubicacion')) {
        await client.sendMessage(chatId, DIRECCION_TEXTO);
        return;
    }

    if (mensaje.includes('telefono') || mensaje.includes('humano')) {
        await client.sendMessage(chatId, CONTACTO_REAL);
        return;
    }

    if (mensaje.includes('agendar') || mensaje.includes('cita') || mensaje.includes('reservar')) {
        usuario.estado = 'agendar';
        usuario.datos = {};
        await client.sendMessage(chatId, 'Perfecto ✂️ Vamos a agendar tu cita. Por favor, escribe tu nombre y apellido juntos.');
        return;
    }

    if (mensaje.includes('consultar') || mensaje.includes('ver cita') || mensaje.includes('mi cita')) {
        usuario.estado = 'consultar';
        await client.sendMessage(chatId, '🔍 Por favor, indícame tu nombre y apellido para consultar tu cita.');
        return;
    }

    // Flujo de agendar cita
    if (usuario.estado === 'agendar') {
        if (!usuario.datos.nombre) {
            const partes = mensaje.split(' ');
            if (partes.length >= 2) {
                usuario.datos.nombre = partes[0];
                usuario.datos.apellido = partes.slice(1).join(' ');
                await client.sendMessage(chatId, '📞 Ahora, por favor, indícanos tu teléfono de contacto.');
                usuario.estado = 'telefono';
            } else {
                await client.sendMessage(chatId, 'Por favor, escribe nombre y apellido juntos.');
            }
            return;
        }
    }

    if (usuario.estado === 'telefono') {
        usuario.datos.telefono = mensaje;
        await client.sendMessage(chatId, '📧 Ahora tu correo electrónico.');
        usuario.estado = 'correo';
        return;
    }

    if (usuario.estado === 'correo') {
        usuario.datos.correo = mensaje;
        await client.sendMessage(chatId, '📅 Indica la fecha y hora para tu cita (ej. "mañana a las 18:00").');
        usuario.estado = 'fecha_hora';
        return;
    }

    if (usuario.estado === 'fecha_hora') {
        usuario.datos.fecha_hora = mensaje;
        await axios.post(MAKE_WEBHOOK_URL, usuario.datos);
        await client.sendMessage(chatId, '✅ Reserva confirmada. Gracias por elegir Blade Razor Barber 💈. Escribe "menu" para empezar otra vez.');
        usuarios[chatId] = { estado: 'clasificando', datos: {}, memoria: {} };
        return;
    }

    // Flujo de consultar cita
    if (usuario.estado === 'consultar') {
        const partes = mensaje.split(' ');
        if (partes.length >= 2) {
            const payload = { nombre: partes[0], apellido: partes.slice(1).join(' ') };
            await axios.post(MAKE_RESPONSE_URL, payload);
            await client.sendMessage(chatId, '🔍 Consultando tus datos, un momento...');
            usuarios[chatId] = { estado: 'clasificando', datos: {}, memoria: payload };
            return;
        } else {
            await client.sendMessage(chatId, 'Por favor, escribe nombre y apellido juntos.');
            return;
        }
    }

    // Por defecto
    await client.sendMessage(chatId, '👋 Soy tu asistente de Blade Razor Barber. Puedes agendar o consultar tu cita en cualquier momento.');
});

client.initialize();
