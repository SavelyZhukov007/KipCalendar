import React, { useState } from 'react';
import {
    Modal,
    Steps,
    Form,
    Input,
    Select,
    Button,
    Alert,
    Space
} from 'antd';
import { API_BASE_URL } from '../config';

const { Option } = Select;
const { TextArea } = Input;

interface CreateOrganizationDialogProps {
    open: boolean;
    onClose: () => void;
    onSuccess: (orgId: string) => void;
}

const orgTypes = [
    { value: 'education', label: 'Образовательное учреждение: Школа/СПО/Университет' },
];

const steps = ['Тип организации', 'Основная информация', 'Контакты'];

const CreateOrganizationDialog: React.FC<CreateOrganizationDialogProps> = ({
    open,
    onClose,
    onSuccess
}) => {
    const [form] = Form.useForm();
    const [activeStep, setActiveStep] = useState(0);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleNext = async () => {
        try {
            if (activeStep === 1) {
                await form.validateFields(['name']);
            }
            setActiveStep((prev) => prev + 1);
            setError('');
        } catch (err) {
            setError('Заполните все обязательные поля');
        }
    };

    const handleBack = () => {
        setActiveStep((prev) => prev - 1);
        setError('');
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);
            setError('');

            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/organizations/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token || ''
                },
                body: JSON.stringify(values)
            });

            const data = await response.json();

            if (response.ok) {
                onSuccess(data.organization_id);
                onClose();
                form.resetFields();
                setActiveStep(0);
            } else {
                setError(data.error || 'Ошибка создания организации');
            }
        } catch (err: any) {
            if (err.errorFields) {
                setError('Заполните все обязательные поля');
            } else {
                setError('Ошибка сети');
            }
        } finally {
            setLoading(false);
        }
    };

    const renderStepContent = (step: number) => {
        switch (step) {
            case 0:
                return (
                    <Form.Item
                        name="type"
                        label="Тип организации"
                        initialValue="education"
                        rules={[{ required: true, message: 'Выберите тип организации' }]}
                    >
                        <Select size="large">
                            {orgTypes.map((option) => (
                                <Option key={option.value} value={option.value}>
                                    {option.label}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                );

            case 1:
                return (
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        <Form.Item
                            name="name"
                            label="Полное название организации"
                            rules={[{ required: true, message: 'Введите название организации' }]}
                        >
                            <Input size="large" placeholder="Название организации" />
                        </Form.Item>
                        <Form.Item
                            name="short_name"
                            label="Сокращённое название (опционально)"
                        >
                            <Input size="large" placeholder="Сокращённое название" />
                        </Form.Item>
                        <Form.Item
                            name="rector_name"
                            label="ФИО Директора/Ректора"
                        >
                            <Input size="large" placeholder="ФИО" />
                        </Form.Item>
                    </Space>
                );

            case 2:
                return (
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        <Form.Item
                            name="address"
                            label="Адрес"
                        >
                            <TextArea rows={2} placeholder="Адрес организации" />
                        </Form.Item>
                        <Form.Item
                            name="phone"
                            label="Телефон"
                        >
                            <Input size="large" placeholder="Телефон" />
                        </Form.Item>
                        <Form.Item
                            name="website"
                            label="Веб-сайт"
                        >
                            <Input size="large" placeholder="https://example.com" />
                        </Form.Item>
                        <Form.Item
                            name="inn"
                            label="ИНН"
                        >
                            <Input size="large" placeholder="ИНН" />
                        </Form.Item>
                    </Space>
                );

            default:
                return null;
        }
    };

    return (
        <Modal
            title="Создание организации"
            open={open}
            onCancel={onClose}
            width={600}
            footer={null}
            destroyOnClose
        >
            <Steps
                current={activeStep}
                items={steps.map(label => ({ title: label }))}
                style={{ marginBottom: 24, marginTop: 16 }}
            />

            {error && (
                <Alert
                    message={error}
                    type="error"
                    showIcon
                    style={{ marginBottom: 16 }}
                    closable
                    onClose={() => setError('')}
                />
            )}

            <Form
                form={form}
                layout="vertical"
                initialValues={{ type: 'education' }}
            >
                {renderStepContent(activeStep)}
            </Form>

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
                <Button onClick={onClose}>Отмена</Button>
                <Space>
                    {activeStep > 0 && (
                        <Button onClick={handleBack}>Назад</Button>
                    )}
                    {activeStep < steps.length - 1 ? (
                        <Button type="primary" onClick={handleNext}>
                            Далее
                        </Button>
                    ) : (
                        <Button
                            type="primary"
                            onClick={handleSubmit}
                            loading={loading}
                        >
                            Создать организацию
                        </Button>
                    )}
                </Space>
            </div>
        </Modal>
    );
};

export default CreateOrganizationDialog;
