import { NavLink } from 'react-router-dom';
import Icon from '../../../components/Gerais/Icons/Icons';
import { useRecoilValue } from 'recoil';
import { userState } from '../../../state/atom';
import { menuItems } from '../../../hooks/utils/useMenuItens';
import DefaultImage from '../assets/default.webp'

const Sidebar = () => {
  const user = useRecoilValue(userState);
  if (!user) return null;

  console.log(user)

  const userPlano = (user.plano || '').toLowerCase() as 'basico' | 'intermediario' | 'premium';

  const MenuItem = ({ to, children }: { to: string; children: React.ReactNode }) => (
    <NavLink to={to} className={({ isActive }) => `MenuItem ${isActive ? 'active-link' : ''}`}>
      {children}
    </NavLink>
  );

  const principalItems = menuItems.filter(
    (item) =>
      item.section === 'principal' &&
      item.roles.includes(user.tipo_de_usuario) &&
      (!item.planos || item.planos.includes(userPlano))
  );

  const suporteItems = menuItems.filter(
    (item) =>
      item.section === 'suporte' &&
      item.roles.includes(user.tipo_de_usuario) &&
      (!item.planos || item.planos.includes(userPlano))
  );

  const fotoPerfil = user.foto_perfil || DefaultImage

  return (
    <>
      <div className='box-logo'>
        <Icon nome='logo' />
      </div>

      <nav className='principal-menu'>
        <h4>Menu Principal</h4>
        {principalItems.map((item) => (
          <MenuItem key={item.key} to={item.to}>
            <Icon nome={item.icon} /> {item.label}
          </MenuItem>
        ))}
      </nav>

      <nav className='suporte-menu'>
        <h4>Suporte</h4>
        {suporteItems.map((item) => (
          <MenuItem key={item.key} to={item.to}>
            <Icon nome={item.icon} /> {item.label}
          </MenuItem>
        ))}
      </nav>

      <div className='user-menu'>
        <div className='column-info'>
          {user.tipo_de_usuario === 'admin' &&
            <NavLink style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }} to='/configuracoes'>
              <div className='MenuImage'>
                <img src={fotoPerfil} alt={user?.nome} />
              </div>
            </NavLink>
          }
          <NavLink to='/configuracoes'>
            <div className='user-info'>
              <p className='user-name'>{user?.nome.split(' ')[0]}</p>
              <p className='user-email'>{user?.email}</p>
            </div>
          </NavLink>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
// filepath: c:\dev\NKW-FLOW-Front-End\src\components\Layout\Sidebars\Sidebar.tsx
