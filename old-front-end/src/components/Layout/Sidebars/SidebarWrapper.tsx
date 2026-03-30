import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { userState } from '../../../state/atom';
import Sidebar from './Sidebar';
import SidebarClosed from './SidebarClosed';
import './sidebarclosed.css'
import './sidebar.css'

const SidebarWrapper = () => {
    const user = useRecoilValue(userState);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(max-width: 1175.98px)');

        // Define inicial
        setIsMobile(mediaQuery.matches);

        // Listener que roda quando passa do breakpoint
        const handler = (event: MediaQueryListEvent) => {
            setIsMobile(event.matches);
        };

        mediaQuery.addEventListener('change', handler);

        return () => mediaQuery.removeEventListener('change', handler);
    }, []);


    if (!user) return null;

    const modoSidebar = user.modo_side_bar;

    return (

        <div
            key={modoSidebar + isMobile}
            className={modoSidebar === 'Minimal' || (modoSidebar === 'Full' && isMobile)
                ? 'sidebarclosed'
                : 'sidebar'}
        >
            {modoSidebar === 'Minimal' || (modoSidebar === 'Full' && isMobile)
                ? <SidebarClosed />
                : <Sidebar />}
        </div>

    );
};

export default SidebarWrapper;