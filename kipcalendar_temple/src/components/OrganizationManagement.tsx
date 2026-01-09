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
  Grid,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Alert,
  Snackbar,
  Chip
} from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon, ContentCopy as CopyIcon } from '@mui/icons-material';
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
    <div role="tabpanel" hidden={value !== index} {...other}>
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

interface Building {
  id: string;
  name: string;
  address: string;
  rooms_count: number;
}

interface Group {
  id: string;
  name: string;
  specialty: string;
  course: number;
  students_count: number;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  hours: number;
}

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Invitation {
  id: string;
  role: string;
  link: string;
  created_at: string;
  expires_at: string;
}

const OrganizationManagement: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const [tabValue, setTabValue] = useState(0);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  // States for dialogs
  const [buildingDialog, setBuildingDialog] = useState(false);
  const [groupDialog, setGroupDialog] = useState(false);
  const [subjectDialog, setSubjectDialog] = useState(false);

  // States for data
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  // Form states
  const [buildingForm, setBuildingForm] = useState({ name: '', address: '', rooms_count: 0 });
  const [groupForm, setGroupForm] = useState({ name: '', specialty: '', course: 1 });
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', hours: 0 });

  // Notification
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchOrganization();
  }, [orgId]);

  useEffect(() => {
    if (tabValue === 1) fetchBuildings();
    if (tabValue === 2) fetchGroups();
    if (tabValue === 3) fetchSubjects();
    if (tabValue === 5) fetchMembers();
    if (tabValue === 6) fetchInvitations();
  }, [tabValue]);

  const fetchOrganization = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/organizations/${orgId}/profile`,
        { headers: { 'Authorization': token || '' } }
      );
      if (response.ok) {
        const data = await response.json();
        setOrganization(data);
      } else {
        console.error('Failed to fetch organization');
      }
    } catch (err) {
      console.error('Failed to fetch organization:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBuildings = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/organizations/${orgId}/buildings`,
        { headers: { 'Authorization': token || '' } }
      );
      if (response.ok) {
        const data = await response.json();
        setBuildings(data);
      }
    } catch (err) {
      console.error('Failed to fetch buildings:', err);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/organizations/${orgId}/groups`,
        { headers: { 'Authorization': token || '' } }
      );
      if (response.ok) {
        const data = await response.json();
        setGroups(data);
      }
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    }
  };

  const fetchSubjects = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/organizations/${orgId}/subjects`,
        { headers: { 'Authorization': token || '' } }
      );
      if (response.ok) {
        const data = await response.json();
        setSubjects(data);
      }
    } catch (err) {
      console.error('Failed to fetch subjects:', err);
    }
  };

  const fetchMembers = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/organizations/${orgId}/members`,
        { headers: { 'Authorization': token || '' } }
      );
      if (response.ok) {
        const data = await response.json();
        setMembers(data);
      }
    } catch (err) {
      console.error('Failed to fetch members:', err);
    }
  };

  const fetchInvitations = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/organizations/${orgId}/invitations`,
        { headers: { 'Authorization': token || '' } }
      );
      if (response.ok) {
        const data = await response.json();
        setInvitations(data);
      }
    } catch (err) {
      console.error('Failed to fetch invitations:', err);
    }
  };

  // Building handlers
  const handleCreateBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/organizations/${orgId}/buildings`,
        {
          method: 'POST',
          headers: {
            'Authorization': token || '',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(buildingForm)
        }
      );
      if (response.ok) {
        setSnackbar({ open: true, message: 'Здание добавлено', severity: 'success' });
        setBuildingDialog(false);
        setBuildingForm({ name: '', address: '', rooms_count: 0 });
        fetchBuildings();
      } else {
        setSnackbar({ open: true, message: 'Ошибка при создании здания', severity: 'error' });
      }
    } catch (err) {
      setSnackbar({ open: true, message: 'Ошибка при создании здания', severity: 'error' });
    }
  };

  const handleDeleteBuilding = async (id: string) => {
    if (!window.confirm('Удалить здание?')) return;
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/organizations/${orgId}/buildings/${id}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': token || '' }
        }
      );
      if (response.ok) {
        setSnackbar({ open: true, message: 'Здание удалено', severity: 'success' });
        fetchBuildings();
      } else {
        setSnackbar({ open: true, message: 'Ошибка при удалении', severity: 'error' });
      }
    } catch (err) {
      setSnackbar({ open: true, message: 'Ошибка при удалении', severity: 'error' });
    }
  };

  // Group handlers
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/organizations/${orgId}/groups`,
        {
          method: 'POST',
          headers: {
            'Authorization': token || '',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(groupForm)
        }
      );
      if (response.ok) {
        setSnackbar({ open: true, message: 'Группа создана', severity: 'success' });
        setGroupDialog(false);
        setGroupForm({ name: '', specialty: '', course: 1 });
        fetchGroups();
      } else {
        setSnackbar({ open: true, message: 'Ошибка при создании группы', severity: 'error' });
      }
    } catch (err) {
      setSnackbar({ open: true, message: 'Ошибка при создании группы', severity: 'error' });
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!window.confirm('Удалить группу?')) return;
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/organizations/${orgId}/groups/${id}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': token || '' }
        }
      );
      if (response.ok) {
        setSnackbar({ open: true, message: 'Группа удалена', severity: 'success' });
        fetchGroups();
      } else {
        setSnackbar({ open: true, message: 'Ошибка при удалении', severity: 'error' });
      }
    } catch (err) {
      setSnackbar({ open: true, message: 'Ошибка при удалении', severity: 'error' });
    }
  };

  // Subject handlers
  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/organizations/${orgId}/subjects`,
        {
          method: 'POST',
          headers: {
            'Authorization': token || '',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(subjectForm)
        }
      );
      if (response.ok) {
        setSnackbar({ open: true, message: 'Предмет добавлен', severity: 'success' });
        setSubjectDialog(false);
        setSubjectForm({ name: '', code: '', hours: 0 });
        fetchSubjects();
      } else {
        setSnackbar({ open: true, message: 'Ошибка при создании предмета', severity: 'error' });
      }
    } catch (err) {
      setSnackbar({ open: true, message: 'Ошибка при создании предмета', severity: 'error' });
    }
  };

  const handleDeleteSubject = async (id: string) => {
    if (!window.confirm('Удалить предмет?')) return;
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/organizations/${orgId}/subjects/${id}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': token || '' }
        }
      );
      if (response.ok) {
        setSnackbar({ open: true, message: 'Предмет удален', severity: 'success' });
        fetchSubjects();
      } else {
        setSnackbar({ open: true, message: 'Ошибка при удалении', severity: 'error' });
      }
    } catch (err) {
      setSnackbar({ open: true, message: 'Ошибка при удалении', severity: 'error' });
    }
  };

  // Invitation handlers
  const handleCreateInvitation = async (role: string) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/organizations/${orgId}/invitations`,
        {
          method: 'POST',
          headers: {
            'Authorization': token || '',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ role })
        }
      );
      if (response.ok) {
        setSnackbar({ open: true, message: 'Приглашение создано', severity: 'success' });
        fetchInvitations();
      } else {
        setSnackbar({ open: true, message: 'Ошибка при создании приглашения', severity: 'error' });
      }
    } catch (err) {
      setSnackbar({ open: true, message: 'Ошибка при создании приглашения', severity: 'error' });
    }
  };

  const handleCopyInviteLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setSnackbar({ open: true, message: 'Ссылка скопирована', severity: 'success' });
  };

  const handleDeleteInvitation = async (id: string) => {
    if (!window.confirm('Удалить приглашение?')) return;
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/organizations/${orgId}/invitations/${id}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': token || '' }
        }
      );
      if (response.ok) {
        setSnackbar({ open: true, message: 'Приглашение удалено', severity: 'success' });
        fetchInvitations();
      } else {
        setSnackbar({ open: true, message: 'Ошибка при удалении', severity: 'error' });
      }
    } catch (err) {
      setSnackbar({ open: true, message: 'Ошибка при удалении', severity: 'error' });
    }
  };

  if (loading) return <Container maxWidth="lg" sx={{ mt: 4 }}><Typography>Загрузка...</Typography></Container>;
  if (!organization) return <Container maxWidth="lg" sx={{ mt: 4 }}><Typography>Организация не найдена</Typography></Container>;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        {organization.name}
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="subtitle2" color="text.secondary">Участников</Typography>
              <Typography variant="h6">{organization.stats.members}</Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="subtitle2" color="text.secondary">Групп</Typography>
              <Typography variant="h6">{organization.stats.groups}</Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="subtitle2" color="text.secondary">Предметов</Typography>
              <Typography variant="h6">{organization.stats.subjects}</Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Общая информация" />
        <Tab label="Здания и кабинеты" />
        <Tab label="Группы" />
        <Tab label="Предметы" />
        <Tab label="Расписание" />
        <Tab label="Участники" />
        <Tab label="Приглашения" />
      </Tabs>

      {/* Tab 0: General Info */}
      <TabPanel value={tabValue} index={0}>
        <Typography paragraph>Адрес: {organization.address || 'Не указан'}</Typography>
        <Typography paragraph>Телефон: {organization.phone || 'Не указан'}</Typography>
        <Typography paragraph>Сайт: {organization.website || 'Не указан'}</Typography>
        <Typography paragraph>Директор/Ректор: {organization.rector_name || 'Не указан'}</Typography>
      </TabPanel>

      {/* Tab 1: Buildings */}
      <TabPanel value={tabValue} index={1}>
        <Button variant="contained" onClick={() => setBuildingDialog(true)} sx={{ mb: 2 }}>
          Добавить здание
        </Button>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Название</TableCell>
                <TableCell>Адрес</TableCell>
                <TableCell>Кабинетов</TableCell>
                <TableCell>Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {buildings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    <Typography color="text.secondary">Нет зданий</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                buildings.map((building) => (
                  <TableRow key={building.id}>
                    <TableCell>{building.name}</TableCell>
                    <TableCell>{building.address}</TableCell>
                    <TableCell>{building.rooms_count}</TableCell>
                    <TableCell>
                      <IconButton onClick={() => handleDeleteBuilding(building.id)} color="error" size="small">
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Tab 2: Groups */}
      <TabPanel value={tabValue} index={2}>
        <Button variant="contained" onClick={() => setGroupDialog(true)} sx={{ mb: 2 }}>
          Создать группу
        </Button>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Название</TableCell>
                <TableCell>Специальность</TableCell>
                <TableCell>Курс</TableCell>
                <TableCell>Студентов</TableCell>
                <TableCell>Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography color="text.secondary">Нет групп</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                groups.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell>{group.name}</TableCell>
                    <TableCell>{group.specialty}</TableCell>
                    <TableCell>{group.course}</TableCell>
                    <TableCell>{group.students_count}</TableCell>
                    <TableCell>
                      <IconButton onClick={() => handleDeleteGroup(group.id)} color="error" size="small">
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Tab 3: Subjects */}
      <TabPanel value={tabValue} index={3}>
        <Button variant="contained" onClick={() => setSubjectDialog(true)} sx={{ mb: 2 }}>
          Добавить предмет
        </Button>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Название</TableCell>
                <TableCell>Код</TableCell>
                <TableCell>Часов</TableCell>
                <TableCell>Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {subjects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    <Typography color="text.secondary">Нет предметов</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                subjects.map((subject) => (
                  <TableRow key={subject.id}>
                    <TableCell>{subject.name}</TableCell>
                    <TableCell>{subject.code}</TableCell>
                    <TableCell>{subject.hours}</TableCell>
                    <TableCell>
                      <IconButton onClick={() => handleDeleteSubject(subject.id)} color="error" size="small">
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Tab 4: Schedule */}
      <TabPanel value={tabValue} index={4}>
        <Typography variant="h6" gutterBottom>Загрузка расписания</Typography>
        <Button variant="contained" component="label">
          Загрузить Excel файл
          <input type="file" hidden accept=".xlsx,.xls" />
        </Button>
        <Alert severity="info" sx={{ mt: 2 }}>
          Поддерживаемые форматы: .xlsx, .xls
        </Alert>
      </TabPanel>

      {/* Tab 5: Members */}
      <TabPanel value={tabValue} index={5}>
        <Typography variant="h6" gutterBottom>Участники организации</Typography>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Имя</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Роль</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} align="center">
                    <Typography color="text.secondary">Нет участников</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>{member.name}</TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      <Chip 
                        label={member.role} 
                        size="small" 
                        color={member.role === 'admin' ? 'error' : member.role === 'teacher' ? 'primary' : 'default'}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Tab 6: Invitations */}
      <TabPanel value={tabValue} index={6}>
        <Typography variant="h6" gutterBottom>Пригласительные ссылки</Typography>
        <Box sx={{ mb: 3 }}>
          <Button variant="contained" onClick={() => handleCreateInvitation('admin')} sx={{ mr: 2, mb: 1 }}>
            Создать для администратора
          </Button>
          <Button variant="contained" onClick={() => handleCreateInvitation('teacher')} sx={{ mr: 2, mb: 1 }}>
            Создать для преподавателя
          </Button>
          <Button variant="contained" onClick={() => handleCreateInvitation('student')} sx={{ mb: 1 }}>
            Создать для студента
          </Button>
        </Box>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Роль</TableCell>
                <TableCell>Ссылка</TableCell>
                <TableCell>Создано</TableCell>
                <TableCell>Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invitations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    <Typography color="text.secondary">Нет приглашений</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                invitations.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell>
                      <Chip 
                        label={invite.role} 
                        size="small"
                        color={invite.role === 'admin' ? 'error' : invite.role === 'teacher' ? 'primary' : 'default'}
                      />
                    </TableCell>
                    <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {invite.link}
                    </TableCell>
                    <TableCell>{new Date(invite.created_at).toLocaleDateString('ru-RU')}</TableCell>
                    <TableCell>
                      <IconButton onClick={() => handleCopyInviteLink(invite.link)} color="primary" size="small">
                        <CopyIcon />
                      </IconButton>
                      <IconButton onClick={() => handleDeleteInvitation(invite.id)} color="error" size="small">
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Building Dialog */}
      <Dialog open={buildingDialog} onClose={() => setBuildingDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Добавить здание</DialogTitle>
        <form onSubmit={handleCreateBuilding}>
          <DialogContent>
            <TextField
              label="Название здания"
              fullWidth
              value={buildingForm.name}
              onChange={(e) => setBuildingForm({ ...buildingForm, name: e.target.value })}
              sx={{ mb: 2 }}
              required
              autoFocus
            />
            <TextField
              label="Адрес"
              fullWidth
              value={buildingForm.address}
              onChange={(e) => setBuildingForm({ ...buildingForm, address: e.target.value })}
              sx={{ mb: 2 }}
              required
            />
            <TextField
              label="Количество кабинетов"
              type="number"
              fullWidth
              value={buildingForm.rooms_count}
              onChange={(e) => setBuildingForm({ ...buildingForm, rooms_count: parseInt(e.target.value) || 0 })}
              inputProps={{ min: 0 }}
              helperText="Укажите количество кабинетов в здании"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setBuildingDialog(false)}>Отмена</Button>
            <Button type="submit" variant="contained">Создать</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Group Dialog */}
      <Dialog open={groupDialog} onClose={() => setGroupDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Создать группу</DialogTitle>
        <form onSubmit={handleCreateGroup}>
          <DialogContent>
            <TextField
              label="Название группы"
              fullWidth
              value={groupForm.name}
              onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
              sx={{ mb: 2 }}
              required
              autoFocus
              placeholder="Например: ИС-21"
            />
            <TextField
              label="Специальность"
              fullWidth
              value={groupForm.specialty}
              onChange={(e) => setGroupForm({ ...groupForm, specialty: e.target.value })}
              sx={{ mb: 2 }}
              required
              placeholder="Например: Информационные системы"
            />
            <TextField
              label="Курс"
              type="number"
              fullWidth
              value={groupForm.course}
              onChange={(e) => setGroupForm({ ...groupForm, course: parseInt(e.target.value) || 1 })}
              inputProps={{ min: 1, max: 6 }}
              required
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setGroupDialog(false)}>Отмена</Button>
            <Button type="submit" variant="contained">Создать</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Subject Dialog */}
      <Dialog open={subjectDialog} onClose={() => setSubjectDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Добавить предмет</DialogTitle>
        <form onSubmit={handleCreateSubject}>
          <DialogContent>
            <TextField
              label="Название предмета"
              fullWidth
              value={subjectForm.name}
              onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
              sx={{ mb: 2 }}
              required
              autoFocus
              placeholder="Например: Математический анализ"
            />
            <TextField
              label="Код предмета"
              fullWidth
              value={subjectForm.code}
              onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
              sx={{ mb: 2 }}
              required
              placeholder="Например: MATH-101"
            />
            <TextField
              label="Количество часов"
              type="number"
              fullWidth
              value={subjectForm.hours}
              onChange={(e) => setSubjectForm({ ...subjectForm, hours: parseInt(e.target.value) || 0 })}
              inputProps={{ min: 0 }}
              required
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSubjectDialog(false)}>Отмена</Button>
            <Button type="submit" variant="contained">Создать</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })} variant="filled">
        {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default OrganizationManagement;