import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';

interface ImageUploadProps {
  value: string | null;
  onChange: (url: string) => void;
  label?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_WIDTH = 600;
const COMPRESSION_QUALITY = 0.82;

export function ImageUpload({ value, onChange, label = 'صورة الغلاف' }: ImageUploadProps) {
  const { show } = useToast();
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(value);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = useCallback((file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('Canvas not supported')); return; }
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error('Compression failed'));
            },
            'image/jpeg',
            COMPRESSION_QUALITY,
          );
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }, []);

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
      const compressed = await compressImage(file);
      const fileName = `cover-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const filePath = `covers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('book-covers')
        .upload(filePath, compressed, { contentType: 'image/jpeg', upsert: false });

      if (uploadError) {
        show('فشل رفع الصورة', 'error');
        return;
      }

      const { data: urlData } = supabase.storage
        .from('book-covers')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;
      setPreview(publicUrl);
      onChange(publicUrl);
      show('تم رفع الصورة بنجاح', 'success');
    } catch {
      show('فشل معالجة الصورة', 'error');
    } finally {
      setUploading(false);
    }
  }, [compressImage, show, onChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleRemove = useCallback(() => {
    setPreview(null);
    onChange('');
  }, [onChange]);

  return (
    <div>
      <label className="label">{label}</label>
      {preview ? (
        <div className="relative inline-block">
          <img src={preview} alt="معاينة الغلاف" className="h-40 w-32 rounded-xl border border-ink-200 object-cover" />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow-lg hover:bg-red-600"
            aria-label="حذف الصورة"
          >
            <X size={14} />
          </button>
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
              <p className="mt-2 text-sm font-semibold text-ink-700">اسحب الصورة هنا أو اضغط للاختيار</p>
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
      {preview && !uploading && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline"
        >
          <ImageIcon size={14} /> تغيير الصورة
        </button>
      )}
    </div>
  );
}
