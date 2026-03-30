// Libs
import React from 'react';
// Assets Geral
import ArrowIcon from './assets/arrow.svg'; 
import CloseIcon from './assets/close.svg';
import InfoIcon from './assets/info.svg';
import InstaIcon from './assets/insta.svg';
import ChatOffIcon from './assets/chatOff.svg';
import ChatOnIcon from './assets/chatOn.svg';
import ConnectIcon from './assets/connect.svg';
import MoneyIcon from './assets/money.svg';
import UserListIcon from './assets/userList.svg';
import LogoIcon from './assets/logo.svg';
import CopyIcon from './assets/copy.svg';
import MedalIcon from './assets/medal.svg';
import CheckIcon from './assets/check.svg';
import CalendarIcon from './assets/calendar.svg';
import ArrowFineIcon from './assets/arrowfine.svg';
import ArrowUp from './assets/arrowup.svg';
import ArrowDown from './assets/arrowdown.svg';
import FilterIcon from './assets/filter.svg';
import NotFilterIcon from './assets/notfilter.svg';
import SaveIcon from './assets/BxSave.svg';
import MicIcon from './assets/mic.svg';
import UploadIcon from './assets/upload.svg';
import TrashIcon from './assets/trash.svg';
import SendIcon from './assets/send.svg';
import PencilIcon from './assets/pencil.svg';
import DotsIcon from './assets/dots.svg';
import Download from './assets/dowload.svg';
import DownnloadTextIcon from './assets/dowloadtext.svg';
import SearchIcon from './assets/search.svg';
import PlayIcon from  './assets/play.svg';
import AddChatIcon from './assets/addchat.svg';
import ArrowSimpleIcon from './assets/arrowsimple.svg';
import UnlockIcon from './assets/unlock.svg';
import PlayAudioIcon from './assets/playaudio.svg';
import PauseIcon from  './assets/pause.svg'
import MicAudioIcon from './assets/micaudio.svg'
import ArrowDownload from './assets/arrowdownload.svg'
import DocumentIcon from './assets/document.svg'
import Eye from './assets/eye.svg'
import EyeOff from './assets/eye-slash.svg'
// Assets Sidebar 
import ConversasIcon from './assets/chat.svg';
import AtendenteIcon from './assets/atendentes.svg';
import AgenteIcon from './assets/bot.svg';
import ConexaoIcon from './assets/conexao.svg';
import ConfigIcon from './assets/config.svg';
import AjudaIcon from './assets/ajuda.svg';
import DashIcon from './assets/dash.svg'
import GiftIcon from './assets/gift.svg'

import ScroolIcon from './assets/mouse-scroll.svg'

const iconMap = {
  eye: Eye,
  scroll: ScroolIcon,
  eyeoff: EyeOff,
  document: DocumentIcon,
  arrowdownload: ArrowDownload,
  micaudio: MicAudioIcon,
  pause: PauseIcon,
  playaudio: PlayAudioIcon,
  unlock: UnlockIcon,
  addchat: AddChatIcon,
  play: PlayIcon,
  dots: DotsIcon,
  search: SearchIcon,
  download: Download,
  downloadtext: DownnloadTextIcon,
  pencil: PencilIcon,
  mic: MicIcon,
  upload: UploadIcon,
  trash: TrashIcon,
  send: SendIcon,
  arrow: ArrowIcon,
  close: CloseIcon,
  info: InfoIcon,
  insta: InstaIcon,
  chatoff: ChatOffIcon,
  chaton: ChatOnIcon,
  connect: ConnectIcon,
  money: MoneyIcon,
  userlist: UserListIcon,
  logo: LogoIcon,
  copy: CopyIcon,
  medal: MedalIcon,
  check: CheckIcon,
  calendar: CalendarIcon,
  arrowfine: ArrowFineIcon,
  conversaspage: ConversasIcon,
  atendentespage: AtendenteIcon,
  agentespage: AgenteIcon,
  conexaopage: ConexaoIcon,
  configpage: ConfigIcon,
  ajudapage: AjudaIcon,
  resumopage: DashIcon,
  recompensapage: GiftIcon,
  filter: FilterIcon,
  notfilter: NotFilterIcon,
  arrowup: ArrowUp,
  arrowdown: ArrowDown,
  save: SaveIcon,
  arrowsimple: ArrowSimpleIcon,
};

type IconName = keyof typeof iconMap;

interface IconProps extends React.SVGProps<SVGSVGElement> {
  nome: IconName; 
}

export default function Icon({ nome, ...props }: IconProps) {
 
  const IconToRender = iconMap[nome];

  if (!IconToRender) {
    return null;
  }

  return <IconToRender {...props} />;
}

export type { IconProps };