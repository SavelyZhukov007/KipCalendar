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

interface OrganizationStats {
  members: number;
  groups: number;
  subjects: number;
}

interface Organization {
  id: string;
  name: string;
  short_name?: string;
  address?: string;
  phone?: string;
  website?: string;
  inn?: string;
  rector_name?: string;
  stats: OrganizationStats;
}

const OrganizationManagement: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const [tabValue, setTabValue] = useState(0);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrganization();
  }, [orgId]);

  const fetchOrganization = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/api/organizations/${orgId}/profile`,
        {
          headers: { 'Authorization': token || '' }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setOrganization(data);
      }
    } catch (err) {
      console.error('Failed to fetch organization:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Container maxWidth="lg" sx={{ mt: 4 }}><Typography>Загрузка...</Typography></Container>;
  if (!organization) return <Container maxWidth="lg" sx={{ mt: 4 }}><Typography>Организация не найдена</Typography></Container>;

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        {organization.name}
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Участников
              </Typography>
              <Typography variant="h6">
                {organization.stats.members}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Групп
              </Typography>
              <Typography variant="h6">
                {organization.stats.groups}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
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
        <Typography>Адрес: {organization.address || 'Не указан'}</Typography>
        <Typography>Телефон: {organization.phone || 'Не указан'}</Typography>
        <Typography>Сайт: {organization.website || 'Не указан'}</Typography>
        <Typography>Директор/Ректор: {organization.rector_name || 'Не указан'}</Typography>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Button variant="contained">Добавить здание</Button>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Button variant="contained">Создать группу</Button>
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <Button variant="contained">Добавить предмет</Button>
      </TabPanel>

      <TabPanel value={tabValue} index={4}>
        <Button variant="contained">Загрузить расписание</Button>
      </TabPanel>

      <TabPanel value={tabValue} index={5}>
        <Typography>Список участников</Typography>
      </TabPanel>

      <TabPanel value={tabValue} index={6}>
        <Typography variant="h6">Пригласительные ссылки</Typography>
        <Button variant="contained" sx={{ mt: 2 }}>Создать приглашение для администратора</Button>
        <Button variant="contained" sx={{ mt: 2, ml: 2 }}>Создать приглашение для преподавателя</Button>
        <Button variant="contained" sx={{ mt: 2, ml: 2 }}>Создать приглашение для студента</Button>
      </TabPanel>
    </Container>
  );
};

export default OrganizationManagement;