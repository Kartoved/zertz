import { useState } from 'react';

export type NavTab = 'playOnline' | 'playLocal' | 'loadGame' | 'rules' | 'players' | 'challenges';

export function useMainMenuModals() {
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [showBoardDialog, setShowBoardDialog] = useState(false);
  const [showOnlineDialog, setShowOnlineDialog] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPlayersModal, setShowPlayersModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showChallengesModal, setShowChallengesModal] = useState(false);
  const [showBotDialog, setShowBotDialog] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [onlineModalInitialStep, setOnlineModalInitialStep] = useState<'board' | 'link'>('board');

  const handleNavTab = (tab: NavTab) => {
    setShowMobileMenu(false);
    switch (tab) {
      case 'playOnline': setShowOnlineDialog(true); break;
      case 'playLocal': setShowBoardDialog(true); break;
      case 'loadGame': setShowLoadDialog(true); break;
      case 'rules': setShowRulesModal(true); break;
      case 'players': setShowPlayersModal(true); break;
      case 'challenges': setShowChallengesModal(true); break;
    }
  };

  return {
    showLoadDialog, setShowLoadDialog,
    showBoardDialog, setShowBoardDialog,
    showOnlineDialog, setShowOnlineDialog,
    showAuthModal, setShowAuthModal,
    showProfileModal, setShowProfileModal,
    showPlayersModal, setShowPlayersModal,
    showRulesModal, setShowRulesModal,
    showChallengesModal, setShowChallengesModal,
    showBotDialog, setShowBotDialog,
    showMobileMenu, setShowMobileMenu,
    onlineModalInitialStep, setOnlineModalInitialStep,
    handleNavTab,
  };
}
