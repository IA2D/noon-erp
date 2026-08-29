import React, { useRef } from 'react';
import NarrationContextMenu from './NarrationContextMenu';
import { useNarrationContextMenu } from '../../hooks/useNarrationContextMenu';

interface LineNarrationFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** البيان الرئيسي (الترويسة) — أو بيان السطر الأول كبديل */
  mainNarration: string;
  /** بيان السطر السابق مباشرة (index - 1) */
  previousNarration?: string;
  /** هل يوجد سطر سابق؟ (خطأ للسطر الأول) */
  hasPrevious?: boolean;
  rowIndex: number;
  className?: string;
  /** سمات إضافية تمرّر إلى عنصر الإدخال الأساسي */
  inputProps?: React.InputHTMLAttributes<HTMLInputElement> & Record<string, unknown>;
}

/**
 * حقل البيان / التفاصيل القابل لإعادة الاستخدام في جداول القيود والسندات:
 * - النقر الأيمن: فتح قائمة سياق "نسخ البيان الرئيسي / السابق".
 * - اختصارات لوحة المفاتيح أثناء التحرير:
 *   Ctrl+D أو F3 → نسخ البيان السابق.
 *   Ctrl+Shift+D أو F4 → نسخ البيان الرئيسي / أول بيان.
 * - يمرّر القيمة عبر onChange ليتم حفظها في حالة النموذج (submit payload).
 */
export default function LineNarrationField({
  value,
  onChange,
  mainNarration,
  previousNarration,
  hasPrevious = false,
  rowIndex,
  className,
  inputProps,
}: LineNarrationFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { menu, openAt, closeMenu, onNarrationKeyDown } = useNarrationContextMenu();

  const applyMain = () => {
    if (mainNarration && mainNarration.trim()) {
      onChange(mainNarration);
    }
    closeMenu();
    inputRef.current?.focus();
  };

  const applyPrevious = () => {
    if (hasPrevious && previousNarration) {
      onChange(previousNarration);
    }
    closeMenu();
    inputRef.current?.focus();
  };

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e =>
          onNarrationKeyDown(e, rowIndex, {
            onCopyMain: applyMain,
            onCopyPrevious: applyPrevious,
          })
        }
        onContextMenu={e => openAt(e, rowIndex)}

        className={className}
        {...inputProps}
      />
      {menu && (
        <NarrationContextMenu
          x={menu.x}
          y={menu.y}
          rowIndex={menu.rowIndex}
          hasPrevious={hasPrevious}
          onCopyMain={applyMain}
          onCopyPrevious={applyPrevious}
          onClose={closeMenu}
        />
      )}
    </>
  );
}
