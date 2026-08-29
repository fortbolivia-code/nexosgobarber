# Nexos Go Barber

## 1. Información general

**Nombre del sistema:** Nexos Go Barber

**Tipo de sistema:** Aplicación web SaaS para gestión y control administrativo de barberías.

**Dominio previsto:** barber.nexosgo.net

**Estado del proyecto:** En desarrollo.

**Propietario de la plataforma:** Nexos Go.

---

## 2. Descripción

Nexos Go Barber es una aplicación web orientada a la gestión operativa y financiera de barberías.

El sistema permitirá a los propietarios de barberías registrar y consultar información relacionada con:

- Clientes.
- Barberos.
- Servicios realizados.
- Ventas de productos.
- Ingresos.
- Gastos.
- Gastos fijos.
- Rendimiento de barberos.
- Historial de clientes.
- Métodos de pago.
- Sucursales.
- Configuración de la barbería.

El sistema utilizará Google Sheets como almacenamiento de datos mediante Google Sheets API.

Cada barbería tendrá su propio Google Spreadsheet independiente.

---

## 3. Problema que resuelve

Muchas barberías llevan el control de sus operaciones mediante:

- Cuadernos.
- Hojas de cálculo sin estructura.
- Registros dispersos.
- Información informal proporcionada por los barberos.
- Cálculos manuales.
- Información financiera difícil de analizar.

Nexos Go Barber busca centralizar esta información en una aplicación web sencilla y estructurada.

El objetivo principal es que el propietario pueda conocer el comportamiento de su barbería sin depender de registros manuales dispersos.

---

## 4. Objetivo principal

Crear una plataforma web que permita a una barbería registrar, organizar y analizar sus operaciones y situación financiera mediante una interfaz sencilla, manteniendo los datos de cada barbería separados y utilizando Google Sheets como fuente de almacenamiento.

---

## 5. Objetivos específicos

### 5.1 Gestión de clientes

Permitir registrar y consultar clientes.

Información principal:

- ID del cliente.
- Nombre.
- Número telefónico opcional.
- Categoría de edad.
- Historial de visitas.
- Historial de servicios.
- Frecuencia de visita.
- Última visita.
- Barbero que realizó el servicio.

Las categorías de edad podrán incluir:

- Niño.
- Adolescente.
- Joven.
- Adulto.

---

### 5.2 Gestión de barberos

Permitir administrar los barberos asociados a una barbería.

El propietario podrá:

- Crear barberos.
- Editar información permitida.
- Activar o desactivar barberos según corresponda.
- Definir porcentaje de comisión.
- Consultar rendimiento.
- Consultar clientes atendidos.
- Consultar servicios realizados.
- Consultar ingresos generados.

Un barbero empleado podrá consultar únicamente la información que corresponda a su propia actividad y clientes.

---

### 5.3 Registro de servicios

Los barberos podrán registrar los servicios realizados.

El registro incluirá como mínimo:

- Cliente.
- Barbero.
- Servicio.
- Fecha.
- Hora.
- Monto.
- Método de pago.
- Sucursal.

Los servicios serán definidos por el propietario de la barbería.

Ejemplos:

- Corte.
- Barba.
- Tinte.
- Diseño.
- Corte infantil.
- Otros.

No existirá un catálogo obligatorio cerrado.

---

### 5.4 Gestión financiera

El sistema permitirá registrar y consultar:

- Ingresos.
- Gastos.
- Gastos fijos.
- Ventas de productos.
- Métodos de pago.
- Resultado financiero registrado.

Los métodos de pago inicialmente serán:

- Efectivo.
- QR.
- Otro.

El sistema registra la información declarada por los usuarios y no verifica físicamente el dinero existente en caja.

---

### 5.5 Gestión de gastos

El propietario podrá registrar gastos manualmente.

Los gastos podrán incluir:

- Alquiler.
- Luz.
- Agua.
- Internet.
- Sueldos.
- Transporte.
- Compras.
- Mantenimiento.
- Equipamiento.
- Publicidad.
- Otros.

El propietario también podrá crear categorías adicionales cuando sea necesario.

---

### 5.6 Gestión de sucursales

Cada barbería comenzará con una sucursal principal.

El propietario de la plataforma podrá habilitar funcionalidades adicionales relacionadas con sucursales según el plan contratado.

Una barbería podrá posteriormente disponer de varias sucursales.

---

### 5.7 Dashboard

El sistema contará con un dashboard para mostrar información resumida de la barbería.

Podrá incluir:

- Ingresos.
- Gastos.
- Resultado.
- Clientes.
- Clientes nuevos.
- Clientes recurrentes.
- Servicios realizados.
- Rendimiento de barberos.
- Métodos de pago.
- Evolución temporal.

---

## 6. Clientes recurrentes

El sistema deberá registrar información suficiente para determinar posteriormente la recurrencia de los clientes.

La clasificación podrá basarse en:

- Número de visitas.
- Frecuencia de visitas.
- Tiempo desde la última visita.
- Visitas durante un período determinado.

La lógica definitiva de segmentación será definida durante el diseño funcional.

Ejemplos posibles:

- Nuevo.
- Ocasional.
- Frecuente.
- Recurrente.
- Inactivo.

Estas categorías serán revisadas antes de su implementación definitiva.

---

## 7. Modelo de negocio

Nexos Go Barber será una plataforma SaaS.

La plataforma podrá ofrecer diferentes planes.

Planes inicialmente previstos:

- Plan Básico.
- Plan Pro.
- Plan Premium.

La asignación del plan será administrada por el administrador de Nexos Go.

La plataforma podrá limitar determinadas funcionalidades dependiendo del plan.

Ejemplos:

- Cantidad de barberos habilitados.
- Cantidad de sucursales.
- Funcionalidades adicionales.
- Acceso a servicios complementarios.

La lógica exacta de cada plan será definida posteriormente.

---

## 8. Administración de la plataforma

Existirá un administrador principal de Nexos Go.

Este administrador tendrá control sobre:

- Creación de barberías.
- Activación de barberías.
- Planes.
- Barberos habilitados.
- Sucursales habilitadas.
- Configuración general.
- Gestión de permisos.
- Configuración de la plataforma.

Los propietarios de las barberías no podrán crear nuevas barberías desde el sistema.

---

## 9. Separación de datos

Cada barbería tendrá un Google Spreadsheet independiente.

Ejemplo:

```text
Barbería A
    ↓
Google Spreadsheet A

Barbería B
    ↓
Google Spreadsheet B

Barbería C
    ↓
Google Spreadsheet C