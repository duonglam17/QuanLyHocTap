import { useState } from 'react';
import { Download, File, FileArchive, FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from '@/shared/components/atoms/Button.jsx';
import { Spinner } from '@/shared/components/atoms/Spinner.jsx';
import { toast } from '@/shared/components/molecules/Toast.jsx';
import { formatDateTime, formatFileSize } from '@/shared/lib';
import { downloadMaterial } from '../api/lessons.js';

function getFileIcon(name = '') {
  const ext = name.toLowerCase().split('.').pop();
  switch (ext) {
    case 'pdf':
      return <FileText aria-hidden="true" className="size-5 text-red-500" />;
    case 'doc':
    case 'docx':
      return <FileText aria-hidden="true" className="size-5 text-blue-500" />;
    case 'ppt':
    case 'pptx':
      return <FileSpreadsheet aria-hidden="true" className="size-5 text-orange-500" />;
    case 'zip':
    case 'rar':
      return <FileArchive aria-hidden="true" className="size-5 text-amber-500" />;
    default:
      return <File aria-hidden="true" className="size-5 text-muted-foreground" />;
  }
}

export function MaterialItem({ material, courseId }) {
  const [isDownloading, setIsDownloading] = useState(false);

  async function handleDownload() {
    setIsDownloading(true);
    try {
      await downloadMaterial(courseId, material.id);
      toast.success(`Đã tải xuống "${material.originalName || material.title}"`);
    } catch (error) {
      toast.error(error.message || 'Không thể tải xuống tài liệu.');
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-xs transition-colors hover:bg-muted/30">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 shrink-0 rounded bg-muted p-2">
          {getFileIcon(material.originalName)}
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground text-sm" title={material.title}>
            {material.title}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {material.originalName ? (
              <span className="truncate max-w-[180px] sm:max-w-xs" title={material.originalName}>
                {material.originalName}
              </span>
            ) : null}
            <span>•</span>
            <span>{formatFileSize(material.size)}</span>
            {material.createdAt ? (
              <>
                <span>•</span>
                <span>{formatDateTime(material.createdAt)}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <Button
        aria-label={`Tải xuống tài liệu ${material.title}`}
        disabled={isDownloading}
        onClick={handleDownload}
        size="sm"
        title="Tải tài liệu về máy"
        variant="outline"
      >
        {isDownloading ? (
          <Spinner className="size-4" />
        ) : (
          <>
            <Download aria-hidden="true" className="mr-1.5 size-4" />
            <span className="hidden sm:inline">Tải về</span>
          </>
        )}
      </Button>
    </div>
  );
}
