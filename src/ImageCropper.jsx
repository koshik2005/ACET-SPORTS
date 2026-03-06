import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';

export function ImageCropper({ image, onCropComplete, onCancel, dark }) {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    const onCropChange = (crop) => setCrop(crop);
    const onZoomChange = (zoom) => setZoom(zoom);

    const onCropCompleteInternal = useCallback((_croppedArea, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleConfirm = async () => {
        try {
            const croppedImage = await getCroppedImg(image, croppedAreaPixels);
            onCropComplete(croppedImage);
        } catch (e) {
            console.error(e);
            alert("Failed to crop image.");
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            zIndex: 1000, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
            <div style={{
                position: 'relative', width: '100%', maxWidth: 500, height: 400,
                background: dark ? '#1a1a2e' : '#fff', borderRadius: 20, overflow: 'hidden'
            }}>
                <Cropper
                    image={image}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    onCropChange={onCropChange}
                    onCropComplete={onCropCompleteInternal}
                    onZoomChange={onZoomChange}
                />
            </div>

            <div style={{
                marginTop: 20, width: '100%', maxWidth: 500, background: dark ? '#1a1a2e' : '#fff',
                padding: 20, borderRadius: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
            }}>
                <div style={{ marginBottom: 15 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: dark ? '#aaa' : '#666', marginBottom: 8 }}>ZOOM</label>
                    <input
                        type="range"
                        value={zoom}
                        min={1}
                        max={3}
                        step={0.1}
                        aria-labelledby="Zoom"
                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                        style={{ width: '100%', cursor: 'pointer' }}
                    />
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={onCancel} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: dark ? '#333' : '#eee', color: dark ? '#ccc' : '#444', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleConfirm} style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#8B0000,#C41E3A)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Crop & Upload</button>
                </div>
            </div>
        </div>
    );
}

async function getCroppedImg(imageSrc, pixelCrop) {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
    );

    return canvas.toDataURL('image/jpeg', 0.9);
}

const createImage = (url) =>
    new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener('load', () => resolve(image));
        image.addEventListener('error', (error) => reject(error));
        image.setAttribute('crossOrigin', 'anonymous');
        image.src = url;
    });
