
import { Scanner } from '@yudiel/react-qr-scanner';
import { X } from 'lucide-react';

interface QRScannerProps {
    onScan: (result: string) => void;
    onClose: () => void;
    instruction?: string;
}

export default function QRScanner({ onScan, onClose, instruction }: QRScannerProps) {
    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
            {/* Close Button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 z-20 text-white p-2 bg-black/50 rounded-full hover:bg-white/20 transition"
            >
                <X size={32} />
            </button>

            {/* Scanner Container */}
            <div className="w-full max-w-md aspect-square relative">
                <Scanner
                    onScan={(result) => {
                        if (result && result.length > 0) {
                            onScan(result[0].rawValue);
                        }
                    }}
                    components={{
                        // audio: false,       // 預設關閉，新版可能不支援此參數，先註解掉以免報錯
                        finder: true,       // 顯示掃描框
                    }}
                    styles={{
                        container: {
                            width: '100%',
                            height: '100%',
                        }
                    }}
                />

                {/* Overlay Text */}
                <div className="absolute top-0 left-0 right-0 p-8 text-center pointer-events-none">
                    <p className="text-white text-lg font-medium drop-shadow-md">
                        {instruction || "請掃描 QR Code"}
                    </p>
                </div>
            </div>

            <div className="mt-8 px-8 text-center text-gray-400 text-sm">
                請將店鋪提供的 QR Code 置於方框內
            </div>
        </div>
    );
}
