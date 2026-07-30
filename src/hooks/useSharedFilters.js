import { useState } from 'react';

// Общие фильтры, используемые сразу на нескольких вкладках (СМР, Метрики)
export function useSharedFilters() {
  const [selectedBranch, setSelectedBranch] = useState('Все');
  const [selectedContractor, setSelectedContractor] = useState('Все');
  const [selectedSection, setSelectedSection] = useState('Все');
  const [selectedDate, setSelectedDate] = useState('');
  const [openDropdown, setOpenDropdown] = useState(null);

  return {
    selectedBranch, setSelectedBranch,
    selectedContractor, setSelectedContractor,
    selectedSection, setSelectedSection,
    selectedDate, setSelectedDate,
    openDropdown, setOpenDropdown,
  };
}
