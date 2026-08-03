import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { Upload, X, Image as ImageIcon, Loader2, FileCheck2 } from 'lucide-react';

interface ReceiptUploadProps {
  value: string | null;
  onChange: (url: string) => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function ReceiptUpload({ value, onChange }: ReceiptUploadProps) {
  const { show } = useToast();
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      show('صيغة الملف غير مدعومة. يرجى استخدام JPG أو PNG أو WEBP', 'error');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      show('حجم الملف كبير. الحد الأقصى 5 ميجابايت', 'error');
      return;
    }

    setUploading(true);
    try {
      const fileName = `receipt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const filePath = `receipts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        show('فشل رفع الإيصال', 'error');
        return;
      }

      const { data: urlData } = supabase.storage
        .from('receipts')
        .getPublicUrl(filePath);

      onChange(urlData.publicUrl);
      show('تم رفع الإيصال بنجاح', 'success');
    } catch {
      show('فشل معالجة الملف', 'error');
    } finally {
      setUploading(false);
    }
  }, [show, onChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleRemove = useCallback(() => {
    onChange('');
  }, [onChange]);

  return (
    <div>
      {value ? (
        <div className="rounded-xl border border-ink-200 p-4">
          <div className="flex items-center gap-4">
            <img src={value} alt="إيصال الدفع" className="h-28 w-28 rounded-lg border border-ink-200 object-cover" />
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
                <FileCheck2 size={18} /> تم رفع الإيصال
              </div>
              <p className="mt-1 text-xs text-ink-400">JPG / PNG / WEBP - حد أقصى 5 ميجابايت</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 rounded-lg bg-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-200"
                >
                  <ImageIcon size={14} /> استبدال
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
                >
                  <X size={14} /> حذف
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
            dragging ? 'border-primary-500 bg-primary-50' : 'border-ink-200 hover:border-primary-400 hover:bg-ink-50'
          }`}
        >
          {uploading ? (
            <>
              <Loader2 size={24} className="animate-spin text-primary-500" />
              <p className="mt-2 text-sm text-ink-500">جاري الرفع...</p>
            </>
          ) : (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-500">
                <Upload size={20} />
              </div>
              <p className="mt-2 text-sm font-semibold text-ink-700">اسحب إيصال الدفع هنا أو اضغط للرفع</p>
              <p className="mt-1 text-xs text-ink-400">JPG / PNG / WEBP - حد أقصى 5 ميجابايت</p>
            </>
          )}
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
