import { motion } from 'framer-motion';
import GlobalStyles from '../../../global.module.css'
import Button from '../../../components/Gerais/Buttons/Button';

export default function HelpHeader() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.4, ease: 'easeOut' }}
      className={GlobalStyles.pageHeader}
    >
      <div className={GlobalStyles.pageHeaderTitles}>
        <h2>Página de Ajuda</h2>
        <h3>Pergunte qualquer coisa que estiver com dúvidas sobre o NKW FLOW.</h3>
      </div>

      <Button
        onClick={() => window.open('https://www.instagram.com/nkw_tech/', '_blank')}
        label="Entre em Contato"
      />

    </motion.div>
  );
}