import { useState, useEffect } from 'react';

export function useNFC() {
    const [isSupported, setIsSupported] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if ('NDEFReader' in window) {
            setIsSupported(true);
        }
    }, []);

    const scanNFC = async (onRead: (message: string) => void) => {
        if (!isSupported) {
            setError('您的裝置不支援 NFC 掃描 (僅支援 Android Chrome)');
            return;
        }

        try {
            setIsScanning(true);
            setError(null);

            // @ts-ignore - NDEFReader is experimental and might not be in standard types
            const ndef = new NDEFReader();
            await ndef.scan();

            ndef.onreading = (event: any) => {
                const decoder = new TextDecoder();
                for (const record of event.message.records) {
                    if (record.recordType === 'text') {
                        const text = decoder.decode(record.data);
                        onRead(text);
                        // Stop scanning after success if needed, checking logic handled by caller
                    }
                }
            };

            ndef.onreadingerror = () => {
                setError('無法讀取 NFC 標籤，請重試');
                setIsScanning(false);
            };

        } catch (err) {
            console.error(err);
            setError('NFC 啟動失敗：' + String(err));
            setIsScanning(false);
        }
    };

    return { isSupported, isScanning, scanNFC, error };
}
