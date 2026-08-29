import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SPREADSHEET_ID =
  process.env.GOOGLE_SHEETS_ID ||
  "1hi5h1EDVKvPjY0gQwkXGIoLQuDlWwcIMXQnZjrT9PII";

const serviceAccountPath = path.join(
  process.cwd(),
  "serviceAccountKey.json"
);

if (!fs.existsSync(serviceAccountPath)) {
  throw new Error(
    "No se encontró serviceAccountKey.json en la raíz del proyecto."
  );
}

const serviceAccount = JSON.parse(
  fs.readFileSync(serviceAccountPath, "utf8")
);

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: serviceAccount.client_email,
    private_key: serviceAccount.private_key,
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const sheets = google.sheets({ version: "v4", auth });

type Row = Record<string, string>;
type Periodo = "dia" | "semana" | "mes" | "3meses" | "6meses" | "anio";

function normalizarHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

async function leerHoja(nombre: string, rango = "A:Z"): Promise<Row[]> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${nombre}!${rango}`,
  });

  const values = response.data.values || [];
  if (!values.length) return [];

  const headers = values[0].map(normalizarHeader);

  return values.slice(1).map((row) => {
    const item: Row = {};
    headers.forEach((header, index) => {
      if (header) item[header] = String(row[index] ?? "").trim();
    });
    return item;
  });
}

function fecha(value: unknown): Date | null {
  if (!value) return null;
  const texto = String(value).trim();
  if (!texto) return null;

  let m = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  m = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(texto);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fechaKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function fechaSolo(value: unknown) {
  const d = fecha(value);
  return d ? fechaKey(d) : "";
}

function inicioDia(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function finDia(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function inicioSemana(d: Date) {
  const x = inicioDia(d);
  const day = x.getDay();
  const diff = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - diff);
  return x;
}

function rangoPeriodo(periodo: Periodo) {
  const ahora = new Date();
  const fin = finDia(ahora);
  let inicio: Date;

  switch (periodo) {
    case "dia":
      inicio = inicioDia(ahora);
      break;
    case "semana":
      inicio = inicioSemana(ahora);
      break;
    case "mes":
      inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
      break;
    case "3meses":
      inicio = new Date(ahora);
      inicio.setMonth(inicio.getMonth() - 3);
      inicio = inicioDia(inicio);
      break;
    case "6meses":
      inicio = new Date(ahora);
      inicio.setMonth(inicio.getMonth() - 6);
      inicio = inicioDia(inicio);
      break;
    case "anio":
      inicio = new Date(ahora.getFullYear(), 0, 1);
      inicio = inicioDia(inicio);
      break;
    default:
      inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  }

  return { inicio, fin };
}

function rangoAnterior(periodo: Periodo) {
  const actual = rangoPeriodo(periodo);
  const duracion =
    actual.fin.getTime() - actual.inicio.getTime();

  return {
    inicio: new Date(actual.inicio.getTime() - duracion - 1),
    fin: new Date(actual.inicio.getTime() - 1),
  };
}

function dentro(value: unknown, inicio: Date, fin: Date) {
  const d = fecha(value);
  return !!d && d >= inicio && d <= fin;
}

function numero(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const texto = String(value).trim();
  if (texto.includes(",") && texto.includes(".")) {
    const ultimoPunto = texto.lastIndexOf(".");
    const ultimaComa = texto.lastIndexOf(",");
    if (ultimaComa > ultimoPunto) {
      return Number(texto.replace(/\./g, "").replace(",", ".")) || 0;
    }
    return Number(texto.replace(/,/g, "")) || 0;
  }
  return Number(texto.replace(",", ".")) || 0;
}

function idBarberia(row: Row) {
  return String(row.ID_BARBERIA || row.BARBERIA_ID || "").trim();
}

function idBarbero(row: Row) {
  return String(row.ID_BARBERO || row.BARBERO_UID || "").trim();
}

function nombreBarbero(row: Row) {
  return String(row.NOMBRE || row.NOMBRE_COMPLETO || row.BARBERO || "Sin nombre").trim();
}

function idCliente(row: Row) {
  return String(row.ID_CLIENTE || "").trim();
}

function nombreCliente(row: Row) {
  return String(row.NOMBRE || row.CLIENTE || "Sin cliente").trim();
}

function porcentajeComision(row: Row) {
  const posibles = [
    "COMISION",
    "PORCENTAJE_COMISION",
    "COMISION_PORCENTAJE",
    "COMISIONES",
  ];

  for (const campo of posibles) {
    if (row[campo] !== undefined && row[campo] !== "") {
      return numero(row[campo]);
    }
  }

  return 0;
}

function calcularComision(monto: number, porcentaje: number) {
  if (!porcentaje || porcentaje <= 0) return 0;
  return porcentaje <= 1
    ? monto * porcentaje
    : monto * (porcentaje / 100);
}

function estadoReserva(row: Row) {
  const posibles = [
    row.ESTADO_RESERVA,
    row.ESTADO,
    row.STATUS,
    row.ESTADO_CITA,
    row.CREADO_POR_UID,
  ];

  const texto = posibles
    .map((value) => String(value || "").trim())
    .find((value) => /CANCEL|PENDIENT|CONFIRM|ATEND|COMPLET|REALIZAD/i.test(value));

  if (!texto) return "PENDIENTE";

  const normalizado = texto
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalizado.includes("CANCEL")) return "CANCELADA";
  if (normalizado.includes("ATEND") || normalizado.includes("COMPLET") || normalizado.includes("REALIZAD")) return "ATENDIDA";
  return "PENDIENTE";
}

function variacion(actual: number, anterior: number) {
  if (anterior === 0) return actual === 0 ? 0 : 100;
  return ((actual - anterior) / anterior) * 100;
}

function horaMinutos(value: string) {
  const [h, m] = String(value || "").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function tiempoRelativo(value: unknown) {
  const d = fecha(value);
  if (!d) return "";

  const diff = Date.now() - d.getTime();
  const minutos = Math.floor(diff / 60000);

  if (minutos < 1) return "Ahora";
  if (minutos < 60) return `Hace ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Hace ${horas} h`;

  const dias = Math.floor(horas / 24);
  if (dias < 30) return `Hace ${dias} d`;

  return d.toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "2-digit",
  });
}

function etiquetaIngresoDia(fechaValor: string) {
  const d = fecha(fechaValor);
  if (!d) return fechaValor;
  return `${String(d.getDate()).padStart(2, "0")}/${String(
    d.getMonth() + 1
  ).padStart(2, "0")}`;
}

function etiquetaMes(fechaValor: string) {
  const d = fecha(fechaValor);
  if (!d) return fechaValor;
  return d.toLocaleDateString("es-BO", {
    month: "short",
  }).replace(".", "");
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const accion = params.get("accion") || "dashboard";
    const idBarberiaParam = String(params.get("idBarberia") || "").trim();

    if (!idBarberiaParam) {
      return NextResponse.json(
        { ok: false, error: "Falta ID_BARBERIA." },
        { status: 400 }
      );
    }

    const barberosTodas = await leerHoja("BARBEROS");
    const barberos = barberosTodas
      .filter((row) => idBarberia(row) === idBarberiaParam)
      .map((row) => ({
        id: idBarbero(row),
        nombre: nombreBarbero(row),
        estado: String(row.ESTADO || "").toUpperCase(),
        fechaIngreso: String(row.FECHA_INGRESO || row.FECHA_CREACION || ""),
      }))
      .filter((item) => item.id);

    if (accion === "barberos") {
      return NextResponse.json({
        ok: true,
        barberos: barberos.map(({ id, nombre }) => ({ id, nombre })),
      });
    }

    const periodo = (params.get("periodo") || "mes") as Periodo;
    const rol = String(params.get("rol") || "admin").toLowerCase();
    const idBarberoSolicitado = String(params.get("idBarbero") || "").trim();
    const uidBarbero = String(params.get("uid") || "").trim();

    const [
      atencionesTodas,
      clientesTodas,
      reservasTodas,
      reservasCanceladasTodas,
      gastosTodas,
    ] = await Promise.all([
      leerHoja("ATENCIONES"),
      leerHoja("CLIENTES"),
      leerHoja("RESERVAS"),
      leerHoja("RESERVAS_CANCELADAS"),
      leerHoja("GASTO"),
    ]);

    const barberosMap = new Map<string, { id: string; nombre: string }>();
    barberos.forEach((b) => barberosMap.set(b.id, { id: b.id, nombre: b.nombre }));

    const barberosPorNombre = new Map<string, { id: string; nombre: string }>();
    barberos.forEach((b) => barberosPorNombre.set(b.nombre.trim().toLowerCase(), { id: b.id, nombre: b.nombre }));

    // En la sesión de los barberos normalmente se guarda el AUTH_UID de Firebase,
    // mientras que las hojas ATENCIONES/RESERVAS usan el ID_BARBERO real (BARB-...).
    // Resolvemos aquí UID -> ID_BARBERO para que el dashboard nunca caiga en datos globales.
    const barberoPorUid = new Map<string, { id: string; nombre: string }>();
    barberosTodas.forEach((row) => {
      if (idBarberia(row) !== idBarberiaParam) return;
      const id = String(row.ID_BARBERO || row.ID || "").trim();
      if (!id) return;
      const nombre = nombreBarbero(row);
      const identificadores = [
        row.AUTH_UID,
        row.UID,
        row.BARBERO_UID,
        row.UID_FIREBASE,
        row.FIREBASE_UID,
        row.USER_UID,
      ]
        .map((v) => String(v || "").trim())
        .filter(Boolean);
      identificadores.forEach((identificador) =>
        barberoPorUid.set(identificador, { id, nombre })
      );
    });

    // Igual que /reservas/api: la sesión puede traer AUTH_UID/UID
    // y las hojas operativas trabajan con ID_BARBERO (BARB-...).
    const identificadorBarbero = uidBarbero || idBarberoSolicitado;
    const barberoSesion = identificadorBarbero
      ? barberosTodas.find((row) => {
          if (idBarberia(row) !== idBarberiaParam) return false;

          const idReal = String(row.ID_BARBERO || row.ID || "").trim();
          const authUid = String(
            row.AUTH_UID || row.UID || row.BARBERO_UID || ""
          ).trim();

          return (
            idReal === identificadorBarbero ||
            authUid === identificadorBarbero
          );
        })
      : null;

    const idBarberoFiltro =
      rol === "barbero"
        ? String(
            barberoSesion?.ID_BARBERO ||
              barberoSesion?.ID ||
              barberoPorUid.get(uidBarbero)?.id ||
              idBarberoSolicitado
          ).trim()
        : idBarberoSolicitado;

    // Nunca permitir que un barbero consulte el dashboard global.
    if (rol === "barbero" && (!idBarberoFiltro || !barberoSesion && !barberoPorUid.get(uidBarbero) && !idBarberoSolicitado)) {
      return NextResponse.json(
        {
          ok: false,
          error: "No se pudo identificar el barbero de la sesión."
        },
        { status: 400 }
      );
    }

    if (rol === "barbero" && identificadorBarbero && !barberoSesion && !barberoPorUid.get(uidBarbero)) {
      return NextResponse.json(
        {
          ok: false,
          error: "El barbero de la sesión no pertenece a esta barbería."
        },
        { status: 403 }
      );
    }

    const atenciones = atencionesTodas.filter((row) => idBarberia(row) === idBarberiaParam);
    const clientes = clientesTodas.filter((row) => idBarberia(row) === idBarberiaParam);
    const reservasActivas = reservasTodas.filter(
      (row) => idBarberia(row) === idBarberiaParam
    );
    const reservasCanceladas = reservasCanceladasTodas.filter(
      (row) => idBarberia(row) === idBarberiaParam
    );
    let gastos = gastosTodas.filter((row) => idBarberia(row) === idBarberiaParam);

    // Los gastos solo se muestran al barbero si la fila tiene un ID_BARBERO
    // asociado. Si GASTO es una hoja global de la barbería, no se debe
    // atribuir ese gasto al barbero.
    if (rol === "barbero") {
      gastos = gastos.filter((row) => {
        const id = idBarbero(row);
        return id && id === idBarberoFiltro;
      });
    }

    // RESERVAS_CANCELADAS es el historial de cancelaciones.
    // Algunas reservas canceladas todavía pueden quedar en RESERVAS,
    // por lo que las unimos por ID sin duplicarlas.
    const reservasMap = new Map<string, Row>();

    reservasActivas.forEach((row) => {
      const id = String(row.ID_RESERVA || "").trim();
      if (id) reservasMap.set(id, row);
    });

    reservasCanceladas.forEach((row) => {
      const id = String(row.ID_RESERVA || "").trim();
      if (id) reservasMap.set(id, { ...row, ESTADO: "CANCELADA" });
    });

    const reservas = Array.from(reservasMap.values());

    function resolverBarbero(row: Row) {
      const id = idBarbero(row);
      if (id && barberosMap.has(id)) return barberosMap.get(id)!;

      const nombre = String(row.BARBERO || "").trim().toLowerCase();
      if (nombre && barberosPorNombre.has(nombre)) {
        return barberosPorNombre.get(nombre)!;
      }

      return { id: id || "", nombre: String(row.BARBERO || "Sin registrar").trim() || "Sin registrar" };
    }

    const { inicio, fin } = rangoPeriodo(periodo);
    const anterior = rangoAnterior(periodo);

    let atencionesPeriodo = atenciones.filter((row) => dentro(row.FECHA, inicio, fin));
    const atencionesAnterior = atenciones.filter((row) => dentro(row.FECHA, anterior.inicio, anterior.fin));

    if (rol === "barbero" && idBarberoFiltro) {
      atencionesPeriodo = atencionesPeriodo.filter((row) => resolverBarbero(row).id === idBarberoFiltro);
    } else if (idBarberoFiltro) {
      atencionesPeriodo = atencionesPeriodo.filter((row) => resolverBarbero(row).id === idBarberoFiltro);
    }

    const ingresos = atencionesPeriodo.reduce((s, row) => s + numero(row.MONTO), 0);
    const ingresosAnterior = atencionesAnterior.reduce((s, row) => s + numero(row.MONTO), 0);

    const gastosPeriodo = gastos.filter((row) => dentro(row.FECHA, inicio, fin));
    const gastosAnteriorPeriodo = gastos.filter((row) => dentro(row.FECHA, anterior.inicio, anterior.fin));
    const gastosTotal = gastosPeriodo.reduce((s, row) => s + numero(row.MONTO), 0);
    const gastosAnterior = gastosAnteriorPeriodo.reduce((s, row) => s + numero(row.MONTO), 0);

    const comisionMap = new Map<string, number>();
    barberos.forEach((b) => {
      comisionMap.set(b.id, porcentajeComision(
        barberosTodas.find((row) => idBarbero(row) === b.id) || {}
      ));
    });

    const comisiones = atencionesPeriodo.reduce((total, row) => {
      const b = resolverBarbero(row);
      return total + calcularComision(numero(row.MONTO), comisionMap.get(b.id) || 0);
    }, 0);

    const ingresosNetos = ingresos - gastosTotal - comisiones;

    const clientesPeriodoIds = new Set(
      atencionesPeriodo.map(idCliente).filter(Boolean)
    );

    const clientesAnteriorIds = new Set(
      atencionesAnterior.map(idCliente).filter(Boolean)
    );

    const fechasVisitas = new Map<string, Date[]>();
    atenciones.forEach((row) => {
      const id = idCliente(row);
      const d = fecha(row.FECHA);
      if (!id || !d) return;
      if (!fechasVisitas.has(id)) fechasVisitas.set(id, []);
      fechasVisitas.get(id)!.push(d);
    });

    let clientesNuevos = 0;
    clientesPeriodoIds.forEach((id) => {
      const visitas = fechasVisitas.get(id) || [];
      if (!visitas.some((d) => d < inicio)) clientesNuevos++;
    });

    const reservasPeriodo = reservas.filter((row) => dentro(row.FECHA, inicio, fin));
    const reservasAnterior = reservas.filter(
      (row) => dentro(row.FECHA, anterior.inicio, anterior.fin)
    );

    // El filtro debe resolverse igual que en ATENCIONES.
    // Esto evita que un ID con formato distinto deje al administrador/barbero
    // con 0 reservas aunque la reserva sí pertenezca al barbero.
    const filtrarReservasPorBarbero = (rows: Row[]) =>
      idBarberoFiltro
        ? rows.filter(
            (row) => resolverBarbero(row).id === idBarberoFiltro
          )
        : rows;

    const reservasPeriodoFiltradas = filtrarReservasPorBarbero(reservasPeriodo);
    const reservasAnteriorFiltradas = filtrarReservasPorBarbero(reservasAnterior);

    // "Reservas" representa reservas reales del período.
    // Las canceladas se muestran en el gráfico, pero NO inflan el contador
    // principal de reservas.
    const reservasNoCanceladasPeriodo = reservasPeriodoFiltradas.filter(
      (row) => estadoReserva(row) !== "CANCELADA"
    );
    const reservasNoCanceladasAnterior = reservasAnteriorFiltradas.filter(
      (row) => estadoReserva(row) !== "CANCELADA"
    );

    const reservasTotales = reservasNoCanceladasPeriodo.length;
    const reservasTotalesAnterior = reservasNoCanceladasAnterior.length;

    const atendidasKeys = new Set(
      atencionesPeriodo.map(
        (row) => `${fechaSolo(row.FECHA)}|${idCliente(row)}|${resolverBarbero(row).id}`
      )
    );

    let atendidasReservas = 0;
    let canceladasReservas = 0;
    let pendientesReservas = 0;

    reservasPeriodoFiltradas.forEach((row) => {
      const estado = estadoReserva(row);
      const key = `${fechaSolo(row.FECHA)}|${idCliente(row)}|${idBarbero(row)}`;
      const atendidaPorAtencion = atendidasKeys.has(key);

      if (estado === "CANCELADA") {
        canceladasReservas++;
      } else if (atendidaPorAtencion || estado === "ATENDIDA") {
        atendidasReservas++;
      } else {
        pendientesReservas++;
      }
    });

    const reservasChart = [
      { nombre: "Atendidas", valor: atendidasReservas },
      { nombre: "Pendientes", valor: pendientesReservas },
      { nombre: "Canceladas", valor: canceladasReservas },
    ];

    /* Ingresos agrupados según el período */
    const ingresoMap = new Map<string, number>();

    atencionesPeriodo.forEach((row) => {
      const d = fecha(row.FECHA);
      if (!d) return;

      let clave = "";
      if (periodo === "dia") {
        clave = String(row.HORA || row.HORA_INICIO || "").trim() || `${String(d.getHours()).padStart(2, "0")}:00`;
      } else if (periodo === "semana" || periodo === "mes") {
        clave = fechaKey(d);
      } else {
        clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      }

      ingresoMap.set(clave, (ingresoMap.get(clave) || 0) + numero(row.MONTO));
    });

    let ingresosChart = Array.from(ingresoMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([clave, valor]) => ({
        nombre:
          periodo === "3meses" || periodo === "6meses" || periodo === "anio"
            ? etiquetaMes(clave + "-01")
            : periodo === "dia"
            ? clave.slice(0, 5)
            : periodo === "semana"
  ? (() => {
      const partes = clave.split("-");
      const anio = Number(partes[0]);
      const mes = Number(partes[1]) - 1;
      const dia = Number(partes[2]);

      return new Date(anio, mes, dia).toLocaleDateString("es-BO", {
        weekday: "long",
      });
    })()
  : clave.slice(8, 10),
        valor,
      }));

    /* Limitar a datos útiles, manteniendo orden */
    if (periodo === "dia") {
      ingresosChart = ingresosChart.slice(-14);
    } else if (periodo === "semana") {
      ingresosChart = ingresosChart.slice(-7);
    } else if (periodo === "mes") {
      ingresosChart = ingresosChart.slice(-31);
    } else if (periodo === "3meses") {
      ingresosChart = ingresosChart.slice(-12);
    } else if (periodo === "6meses") {
      ingresosChart = ingresosChart.slice(-12);
    } else {
      ingresosChart = ingresosChart.slice(-12);
    }

    /* Días con más clientes: agrupar por día de la semana */
    const nombresDias = [
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
      "Domingo",
    ];

    const clientesPorDiaSemana = Array.from(
      { length: 7 },
      () => new Set<string>()
    );
    const atencionesPorDiaSemana = Array(7).fill(0);
    const horasMap = new Map<number, number>();

    atencionesPeriodo.forEach((row) => {
      const d = fecha(row.FECHA);
      if (!d) return;

      // JavaScript: domingo=0. Lo convertimos a lunes=0 ... domingo=6.
      const diaSemana = d.getDay() === 0 ? 6 : d.getDay() - 1;

      const clienteKey = idCliente(row) || nombreCliente(row);
      if (clienteKey) clientesPorDiaSemana[diaSemana].add(clienteKey);
      atencionesPorDiaSemana[diaSemana] += 1;

      const horaTexto = String(row.HORA || row.HORA_INICIO || "").trim();
      let hora = -1;
      if (/^\d{1,2}:\d{2}/.test(horaTexto)) {
        hora = Number(horaTexto.split(":")[0]);
      } else {
        hora = d.getHours();
      }
      if (hora >= 0 && hora <= 23) {
        horasMap.set(hora, (horasMap.get(hora) || 0) + 1);
      }
    });

    // Siempre mostramos los 7 días y dejamos 0 cuando no hubo atenciones.
    // El frontend ya usa BarChart, por lo que las barras serán verticales.
    const diasClientes = nombresDias.map((nombre, index) => ({
      nombre,
      valor: clientesPorDiaSemana[index].size,
      atenciones: atencionesPorDiaSemana[index],
    }));

    const horasAtencion = Array.from(horasMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([hora, valor]) => ({
        nombre: `${String(hora).padStart(2, "0")}:00`,
        valor,
      }));

    /* Rendimiento real por barbero */
    const rendimientoMap = new Map<
      string,
      { nombre: string; ingresos: number; atenciones: number }
    >();

    atencionesPeriodo.forEach((row) => {
      const b = resolverBarbero(row);
      const existente = rendimientoMap.get(b.id || b.nombre) || {
        nombre: b.nombre,
        ingresos: 0,
        atenciones: 0,
      };

      existente.ingresos += numero(row.MONTO);
      existente.atenciones += 1;
      rendimientoMap.set(b.id || b.nombre, existente);
    });

    const rendimientoBruto = Array.from(rendimientoMap.values()).sort(
      (a, b) => b.atenciones - a.atenciones || b.ingresos - a.ingresos
    );

    const totalAtenciones = rendimientoBruto.reduce((s, b) => s + b.atenciones, 0);

    const rendimientoBarberos = rendimientoBruto.map((b) => ({
      nombre: b.nombre,
      porcentaje: totalAtenciones ? (b.atenciones / totalAtenciones) * 100 : 0,
      ingresos: b.ingresos,
      atenciones: b.atenciones,
    }));

    /* Próximas reservas: desde hoy, máximo 5 */
    const ahora = new Date();
    const hoyKey = fechaKey(ahora);

    const clientesMap = new Map<string, { nombre: string; telefono: string }>();
    clientes.forEach((row) => {
      clientesMap.set(idCliente(row), {
        nombre: nombreCliente(row),
        telefono: String(row.TELEFONO || "").trim(),
      });
    });

    const proximasReservas = reservas
      .map((row) => {
        const dKey = fechaSolo(row.FECHA);
        const cliente = clientesMap.get(idCliente(row));
        const barber = resolverBarbero(row);
        const hora = String(row.HORA_INICIO || "").trim();
        return {
          id: String(row.ID_RESERVA || "").trim(),
          fecha: dKey,
          hora,
          cliente: cliente?.nombre || String(row.CLIENTE || "Cliente"),
          barbero: barber.nombre,
          idBarbero: barber.id,
          estado: estadoReserva(row),
          sort: `${dKey} ${hora}`,
        };
      })
      .filter((r) => r.id && r.fecha && r.fecha >= hoyKey && r.estado !== "CANCELADA" && (!idBarberoFiltro || r.idBarbero === idBarberoFiltro))
      .sort((a, b) => a.sort.localeCompare(b.sort))
      .slice(0, 5)
      .map(({ sort, ...rest }) => rest);

    /* Actividad real */
    type Activity = { fecha: Date; icono: string; titulo: string; descripcion: string };
    const actividadesBase: Activity[] = [];

    atenciones.slice(-40).forEach((row) => {
      const d = fecha(row.FECHA);
      if (!d) return;
      const b = resolverBarbero(row);
      const c = clientesMap.get(idCliente(row));
      actividadesBase.push({
        fecha: d,
        icono: "✓",
        titulo: "Servicio realizado",
        descripcion: `${c?.nombre || nombreCliente(row)} · ${b.nombre} · Bs ${numero(row.MONTO).toLocaleString("es-BO")}`,
      });
    });

    clientes.slice(-40).forEach((row) => {
      const d = fecha(row.FECHA_REGISTRO || row.FECHA_CREACION || row.FECHA);
      if (!d) return;
      actividadesBase.push({
        fecha: d,
        icono: "+",
        titulo: "Nuevo cliente",
        descripcion: nombreCliente(row),
      });
    });

    reservas.slice(-40).forEach((row) => {
      const d = fecha(row.FECHA_CREACION || row.FECHA);
      if (!d) return;
      const c = clientesMap.get(idCliente(row));
      const b = resolverBarbero(row);
      actividadesBase.push({
        fecha: d,
        icono: "◷",
        titulo: "Reserva creada",
        descripcion: `${c?.nombre || "Cliente"} · ${b.nombre} · ${String(row.HORA_INICIO || "")}`,
      });
    });

    if ((rol === "admin" || rol === "super_admin") && gastos.length) {
      gastos.slice(-20).forEach((row) => {
        const d = fecha(row.FECHA);
        if (!d) return;
        actividadesBase.push({
          fecha: d,
          icono: "−",
          titulo: "Gasto registrado",
          descripcion: `${String(row.NOMBRE || "Gasto")} · Bs ${numero(row.MONTO).toLocaleString("es-BO")}`,
        });
      });
    }

    const actividades = actividadesBase
      .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
      .slice(0, 6)
      .map((item) => ({
        icono: item.icono,
        titulo: item.titulo,
        descripcion: item.descripcion,
        tiempo: tiempoRelativo(item.fecha),
      }));

    const barberosActivos = barberos.filter((b) => {
      if (!b.estado) return true;
      return ["ACTIVO", "ACTIVE", "HABILITADO"].includes(b.estado);
    }).length;

    const crecimientoIngresos = variacion(ingresos, ingresosAnterior);
    const crecimientoReservas = variacion(reservasTotales, reservasTotalesAnterior);
    const crecimientoClientes = variacion(
      clientesPeriodoIds.size,
      clientesAnteriorIds.size
    );

    const nombreBarberia =
      clientes.find((row) => idBarberia(row) === idBarberiaParam)?.BARBERIA ||
      barberosTodas.find((row) => idBarberia(row) === idBarberiaParam)?.BARBERIA ||
      idBarberiaParam;

    return NextResponse.json({
      ok: true,
      periodo,
      nombreBarberia,
      resumen: {
        ingresos,
        reservas: reservasTotales,
        clientes: clientesPeriodoIds.size,
        clientesNuevos,
        barberos: rol === "barbero" ? 1 : barberos.length,
        barberosActivos: rol === "barbero" ? 1 : barberosActivos,
        crecimientoIngresos,
        crecimientoReservas,
        crecimientoClientes,
        ingresosBrutos: ingresos,
        gastos: gastosTotal,
        comisiones,
        ingresosNetos,
      },
      ingresos: ingresosChart,
      reservas: reservasChart,
      diasClientes,
      horasAtencion,
      rendimientoBarberos,
      proximasReservas,
      actividades,
      idBarberoActual: idBarberoFiltro || "",
    });
  } catch (error: any) {
    console.error("GET /dashboard/api:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "No se pudo cargar el dashboard.",
      },
      { status: 500 }
    );
  }
}