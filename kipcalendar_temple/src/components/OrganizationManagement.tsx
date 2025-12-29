import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  Tabs,
  Tab,
  Box,
  Card,
  CardContent,
  Button,
  Grid
} from '@mui/material';
import { useParams } from 'react-router-dom';
import { API_BASE_URL } from '../config';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const OrganizationManagement: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const [tabValue, setTabValue] = useState(0);
  const [organization, setOrganization] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrganization();
  }, [orgId]);

  const fetchOrganization = async () => {
    const token = localStorage.getItem('token');
    const response = await fetch(
      `${API_BASE_URL}/api/organizations/${orgId}/profile`,
      {
        headers: { 'Authorization': token || '' }
      }
    );
    const data = await response.json();
    setOrganization(data);
    setLoading(false);
  };

  if (loading) return <div>Загрузка...</div>;
  if (!organization) return <div>Организация не найдена</div>;

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        {organization.name}
      </Typography>
      
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary">
                Участников
              </Typography>
              <Typography variant="h6">
                {organization.stats.members}
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary">
                Групп
              </Typography>
              <Typography variant="h6">
                {organization.stats.groups}
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary">
                Предметов
              </Typography>
              <Typography variant="h6">
                {organization.stats.subjects}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
        <Tab label="Общая информация" />
        <Tab label="Здания и кабинеты" />
        <Tab label="Группы" />
        <Tab label="Предметы" />
        <Tab label="Расписание" />
        <Tab label="Участники" />
        <Tab label="Приглашения" />
      </Tabs>

      <TabPanel value={tabValue} index={0}>
        {/* Информация об организации */}
        <Typography>Адрес: {organization.address}</Typography>
        <Typography>Телефон: {organization.phone}</Typography>
        <Typography>Сайт: {organization.website}</Typography>
        {/* Кнопка редактирования для админов */}
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        {/* Компонент управления зданиями и кабинетами */}
        <Button variant="contained">Добавить здание</Button>
        {/* Список зданий с кабинетами */}
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        {/* Компонент управления группами */}
        <Button variant="contained">Создать группу</Button>
        {/* Список групп */}
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        {/* Компонент управления предметами */}
        <Button variant="contained">Добавить предмет</Button>
        {/* Список предметов */}
      </TabPanel>

      <TabPanel value={tabValue} index={4}>
        {/* Редактор расписания */}
        <Button variant="contained">Загрузить расписание</Button>
        {/* Таблица расписания */}
      </TabPanel>

      <TabPanel value={tabValue} index={5}>
        {/* Список участников с ролями */}
      </TabPanel>

      <TabPanel value={tabValue} index={6}>
        {/* Генерация invite-ссылок */}
        <Typography variant="h6">Пригласительные ссылки</Typography>
        <Button variant="contained">Создать приглашение для администратора</Button>
        <Button variant="contained">Создать приглашение для преподавателя</Button>
        <Button variant="contained">Создать приглашение для студента</Button>
      </TabPanel>
    </Container>
  );
};

export default OrganizationManagement;