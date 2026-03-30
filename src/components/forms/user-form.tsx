"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createUser, getActiveRoles, updateUser } from "@/features/users";
import { userFormSchema, type UserFormValues } from "@/shared/schemas/user";
import { useDirtyFormGuard, useFormErrorHandler, useFormSubmit } from "@/hooks";
import { FormCheckbox, FormInput, FormSelect, FormTextarea } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { runMutation } from "@/services/form-service";

interface UserFormProps {
    userId?: string;
    initialValues?: Partial<UserFormValues>;
    loadInitialValues?: () => Promise<Partial<UserFormValues>>;
    onSuccess?: () => void;
}
interface ActiveRoleItem {
    key: string;
    name: string;
}

export function UserForm({
    userId,
    initialValues,
    loadInitialValues,
    onSuccess,
}: UserFormProps) {
    const [activeTab, setActiveTab] = useState("profile");
    const [loadingDefault, setLoadingDefault] = useState(false);
    const [roleOptions, setRoleOptions] = useState<{ value: string; label: string }[]>([]);
    const isEdit = Boolean(userId);

    const form = useForm<UserFormValues>({
        resolver: zodResolver(userFormSchema),
        mode: "onChange",
        defaultValues: {
            name: initialValues?.name ?? "",
            email: initialValues?.email ?? "",
            password: "",
            role: initialValues?.role ?? "",
            isActive: initialValues?.isActive ?? true,
            profile: {
                phone: initialValues?.profile?.phone ?? "",
                address: initialValues?.profile?.address ?? "",
            },
        },
    });

    const {
        control,
        handleSubmit,
        setError,
        reset,
        setFocus,
        formState: { errors, isDirty, isValid },
    } = form;

    useDirtyFormGuard(isDirty);

    useEffect(() => {
        const run = async () => {
            const roles = await getActiveRoles();
            const options = roles.map((item: ActiveRoleItem) => ({
                value: item.key,
                label: item.name,
            }));
            const currentRole = form.getValues("role");
            if (currentRole && !options.some((option: { value: string }) => option.value === currentRole)) {
                options.unshift({ value: currentRole, label: currentRole });
            }
            setRoleOptions(options);
        };
        run();
    }, [form]);

    useEffect(() => {
        if (!loadInitialValues) return;
        const run = async () => {
            setLoadingDefault(true);
            const values = await loadInitialValues();
            reset({
                name: values.name ?? "",
                email: values.email ?? "",
                password: "",
                role: values.role ?? "",
                isActive: values.isActive ?? true,
                profile: {
                    phone: values.profile?.phone ?? "",
                    address: values.profile?.address ?? "",
                },
            });
            setLoadingDefault(false);
        };
        run();
    }, [loadInitialValues, reset]);

    const { handleServerError } = useFormErrorHandler<UserFormValues>({
        setError,
        fieldMap: {
            name: "name",
            email: "email",
            password: "password",
            role: "role",
            isActive: "isActive",
            phone: "profile.phone",
            address: "profile.address",
        },
    });

    const { handleSubmit: submitForm, isSubmitting } = useFormSubmit(
        async (values: UserFormValues) =>
            runMutation(async () => {
                const formData = new FormData();
                formData.set("name", values.name);
                formData.set("email", values.email);
                formData.set("role", values.role);
                formData.set("isActive", String(values.isActive));
                if (values.password) formData.set("password", values.password);
                const response = userId
                    ? await updateUser(userId, formData)
                    : await createUser(formData);
                return response;
            }),
        {
            successMessage: isEdit ? "User berhasil diperbarui" : "User berhasil ditambahkan",
            onSuccess: () => onSuccess?.(),
            onError: (message) => handleServerError(message),
            debounceMs: 500,
        }
    );

    const firstErrorField = useMemo(() => {
        const possible: Array<keyof UserFormValues | "profile.phone" | "profile.address"> = [
            "name",
            "email",
            "password",
            "role",
            "profile.phone",
            "profile.address",
        ];
        return possible.find((key) => {
            if (key === "profile.phone") return Boolean(errors.profile?.phone);
            if (key === "profile.address") return Boolean(errors.profile?.address);
            return Boolean(errors[key]);
        });
    }, [errors]);

    const onInvalid = () => {
        if (!firstErrorField) return;
        if (firstErrorField === "profile.phone") {
            setActiveTab("profile");
            setFocus("profile.phone");
            return;
        }
        if (firstErrorField === "profile.address") {
            setActiveTab("profile");
            setFocus("profile.address");
            return;
        }
        if (firstErrorField === "role") setActiveTab("access");
        else setActiveTab("profile");
        setFocus(firstErrorField);
    };

    return (
        <form onSubmit={handleSubmit((values) => submitForm(values), onInvalid)} className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid h-10 w-full grid-cols-2 rounded-xl">
                    <TabsTrigger value="profile" className="rounded-lg text-xs">Profil</TabsTrigger>
                    <TabsTrigger value="access" className="rounded-lg text-xs">Akses</TabsTrigger>
                </TabsList>
                <TabsContent value="profile" className="mt-4 space-y-3">
                    <FormInput control={control} name="name" label="Nama" required />
                    <FormInput control={control} name="email" type="email" label="Email" required />
                    <FormInput control={control} name="password" type="password" label={isEdit ? "Password Baru" : "Password"} required={!isEdit} />
                    <FormInput control={control} name="profile.phone" label="No. Telepon" />
                    <FormTextarea control={control} name="profile.address" label="Alamat" rows={2} />
                </TabsContent>
                <TabsContent value="access" className="mt-4 space-y-3">
                    <FormSelect control={control} name="role" label="Role" required options={roleOptions} />
                    <FormCheckbox control={control} name="isActive" label="Aktifkan akun" />
                    <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                        Hak akses ditentukan oleh konfigurasi role di menu Hak Akses.
                    </p>
                </TabsContent>
            </Tabs>
            <div className="flex items-center justify-between border-t border-border/40 pt-3">
                <Button type="button" variant="outline" className="rounded-lg" onClick={() => reset()}>
                    Reset
                </Button>
                <Button type="submit" className="rounded-lg px-6" disabled={!isValid || isSubmitting || loadingDefault}>
                    {isSubmitting ? "Menyimpan..." : isEdit ? "Update User" : "Simpan User"}
                </Button>
            </div>
        </form>
    );
}
