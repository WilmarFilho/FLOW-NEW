import { NavLink } from 'react-router-dom';
import Icon from '../../../components/Gerais/Icons/Icons';
import { useRecoilValue } from 'recoil';
import { userState } from '../../../state/atom';
import { menuItems } from '../../../hooks/utils/useMenuItens';

const SidebarClosed = () => {
  const user = useRecoilValue(userState);
  
  if (!user) return null;

  const userPlano = (user.plano || '').toLowerCase() as 'basico' | 'intermediario' | 'premium';

  const MenuItem = ({ to, children }: { to: string; children: React.ReactNode }) => (
    <NavLink to={to} className={({ isActive }) => `MenuItem ${isActive ? 'active-link' : ''}`}>
      {children}
    </NavLink>
  );

  const visibleItems = menuItems.filter(
    (item) =>
      item.roles.includes(user.tipo_de_usuario) &&
      (!item.planos || item.planos.includes(userPlano))
  );

  return (
    <nav className='menu-principal-closed'>
      <div className='itens-list-menu'>
        {visibleItems.map((item) => (
          <MenuItem key={item.key} to={item.to}>
            <Icon nome={item.icon} />
          </MenuItem>
        ))}
      </div>
    </nav>
  );
};

export default SidebarClosed;