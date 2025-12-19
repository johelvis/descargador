# Youtube Downloader Pro 🎥

Aplicación de escritorio moderna para descargar videos y playlists de YouTube en formato MP3 y MP4.

![Screenshot](screenshot_placeholder.png)

## 🚀 Características

*   **Detección Inteligente**: Detecta enlaces del portapapeles automáticamente.
*   **Playlists Completas**: Descarga listas de reproducción enteras con un clic.
*   **Formatos**: Soporte para MP3 (Audio HQ) y MP4 (Video H.264).
*   **Cola de Descargas**: Gestión eficiente con pausa/reanudar.
*   **Historial**: Registro local de descargas.
*   **Diseño Premium**: Interfaz moderna y oscura construida con CSS puro.

## 🛠️ Tecnologías

*   **Electron**: Framework de escritorio.
*   **Node.js & Express**: Backend local para gestión de procesos.
*   **yt-dlp**: Motor de descarga (debe incluirse en `bin/`).
*   **FFmpeg**: Motor de conversión (debe incluirse en `bin/`).

## 📦 Instalación (Desarrollo)

1.  **Clonar el repositorio**:
    ```bash
    git clone https://github.com/tu-usuario/youtube-downloader-pro.git
    cd youtube-downloader-pro
    ```

2.  **Instalar dependencias**:
    ```bash
    npm install
    ```

3.  **Configurar Binarios**:
    *   Crea una carpeta llamada `bin` en la raíz.
    *   Descarga `yt-dlp.exe` y colócalo en `bin/`.
    *   Descarga `ffmpeg.exe` y `ffprobe.exe` y colócalos en `bin/`.

4.  **Ejecutar en modo desarrollo**:
    ```bash
    npm start
    ```

## 🔨 Compilación (Crear .exe)

Para generar el instalador de Windows:

```bash
npm run dist
```
El archivo de instalación aparecerá en la carpeta `dist/`.

## 📄 Licencia

Este proyecto está bajo la Licencia ISC.
