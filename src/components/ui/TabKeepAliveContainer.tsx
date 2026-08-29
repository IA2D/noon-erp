import React from 'react';
import { ERPModule } from '../../constants/permissions';
import { useTabs } from '../../tabs/TabsContext';

interface Props {
  renderModule: (module: ERPModule) => React.ReactNode;
}

/**
 * حاوية Keep-Alive: تُبقي جميع الشاشات المفتوحة مثبّتة في شجرة React
 * مع إخفاء غير النشطة عبر CSS (display:none) بدلاً من إعادة التحميل،
 * فيتم الحفاظ على حالة كل شاشة (البيانات المدخلة، الفلاتر، التمرير...).
 * تغيير reloadToken يُعيد تركيب الشاشة بالكامل (إعادة تحميل يدوية).
 */
export default function TabKeepAliveContainer({ renderModule }: Props) {
  const { tabs, activeTabId } = useTabs();

  return (
    <div className="min-h-full">
      {tabs.map(tab => {
        const isActive = tab.id === activeTabId;
        return (
          <section
            key={`${tab.id}:${tab.reloadToken}`}
            data-tab-panel={tab.id}
            data-active={isActive}
            aria-hidden={!isActive}
            className={isActive ? `min-h-full ${tab.module === 'HOME' ? '' : 'pt-4'}` : 'hidden'}
          >
            {renderModule(tab.module)}
          </section>
        );
      })}
    </div>
  );
}
