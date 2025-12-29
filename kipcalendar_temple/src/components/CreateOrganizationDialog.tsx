import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    MenuItem,
    Stepper,
    Step,
    StepLabel,
    Box,
    Typography,
    Alert
} from '@mui/material';
import { API_BASE_URL } from '../config';

interface CreateOrganizationDialogProps {
    open: boolean;
    onClose: () => void;
    onSuccess: (orgId: string) => void;
}

const orgTypes = [
    { value: 'education', label: 'Образовательное учреждение: Школа/СПО/Университет' },
    // Можно добавить другие типы в будущем
];

const steps = ['Тип организации', 'Основная информация', 'Контакты'];

const CreateOrganizationDialog: React.FC<CreateOrganizationDialogProps> = ({
    open,
    onClose,
    onSuccess
}) => {
    const [activeStep, setActiveStep] = useState(0);
    const [formData, setFormData] = useState({
        type: 'education',
        name: '',
        short_name: '',
        address: '',
        phone: '',
        website: '',
        inn: '',
        rector_name: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleNext = () => {
        // Валидация на каждом шаге
        if (activeStep === 1 && !formData.name) {
            setError('Введите название организации');
            return;
        }

        setActiveStep((prev) => prev + 1);
        setError('');
    };

    const handleBack = () => {
        setActiveStep((prev) => prev - 1);
        setError('');
    };

    const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [field]: e.target.value });
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError('');

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/organizations/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token || ''
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                onSuccess(data.organization_id);
                onClose();
                // Сбрасываем форму
                setFormData({
                    type: 'education',
                    name: '',
                    short_name: '',
                    address: '',
                    phone: '',
                    website: '',
                    inn: '',
                    rector_name: ''
                });
                setActiveStep(0);
            } else {
                setError(data.error || 'Ошибка создания организации');
            }
        } catch (err) {
            setError('Ошибка сети');
        } finally {
            setLoading(false);
        }
    };

    const renderStepContent = (step: number) => {
        switch (step) {
            case 0:
                return (
                    <TextField
                        select
                        fullWidth
                        label="Тип организации"
                        value={formData.type}
                        onChange={handleChange('type')}
                        margin="normal"
                    >
                        {orgTypes.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                                {option.label}
                            </MenuItem>
                        ))}
                    </TextField>
                );

            case 1:
                return (
                    <Box>
                        <TextField
                            fullWidth
                            label="Полное название организации *"
                            value={formData.name}
                            onChange={handleChange('name')}
                            margin="normal"
                            required
                        />
                        <TextField
                            fullWidth
                            label="Сокращённое название (опционально)"
                            value={formData.short_name}
                            onChange={handleChange('short_name')}
                            margin="normal"
                        />
                        <TextField
                            fullWidth
                            label="ФИО Директора/Ректора"
                            value={formData.rector_name}
                            onChange={handleChange('rector_name')}
                            margin="normal"
                        />
                    </Box>
                );

            case 2:
                return (
                    <Box>
                        <TextField
                            fullWidth
                            label="Адрес"
                            value={formData.address}
                            onChange={handleChange('address')}
                            margin="normal"
                            multiline
                            rows={2}
                        />
                        <TextField
                            fullWidth
                            label="Телефон"
                            value={formData.phone}
                            onChange={handleChange('phone')}
                            margin="normal"
                        />
                        <TextField
                            fullWidth
                            label="Веб-сайт"
                            value={formData.website}
                            onChange={handleChange('website')}
                            margin="normal"
                        />
                        <TextField
                            fullWidth
                            label="ИНН"
                            value={formData.inn}
                            onChange={handleChange('inn')}
                            margin="normal"
                        />
                    </Box>
                );

            default:
                return null;
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Создание организации</DialogTitle>
            <DialogContent>
                <Stepper activeStep={activeStep} sx={{ pt: 3, pb: 5 }}>
                    {steps.map((label) => (
                        <Step key={label}>
                            <StepLabel>{label}</StepLabel>
                        </Step>
                    ))}
                </Stepper>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {renderStepContent(activeStep)}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Отмена</Button>
                {activeStep > 0 && (
                    <Button onClick={handleBack}>Назад</Button>
                )}
                {activeStep < steps.length - 1 ? (
                    <Button onClick={handleNext} variant="contained">
                        Далее
                    </Button>
                ) : (
                    <Button
                        onClick={handleSubmit}
                        variant="contained"
                        disabled={loading}
                    >
                        {loading ? 'Создание...' : 'Создать организацию'}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default CreateOrganizationDialog;