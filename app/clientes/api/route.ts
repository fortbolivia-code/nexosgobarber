import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { adminAuth } from "@/lib/firebase-admin";
import fs from "fs";
import path from "path";

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

const googleAuth = new google.auth.GoogleAuth({
  credentials: {
    client_email: serviceAccount.client_email,
    private_key: serviceAccount.private_key,
  },
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
  ],
});

const sheets = google.sheets({
  version: "v4",
  auth: googleAuth,
});

function texto(valor: unknown) {
  return String(valor ?? "").trim();
}

function normalizar(valor: unknown) {
  return texto(valor).trim().toLowerCase();
}

async function getAuthenticatedUser(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("NO_AUTH");
  }

  const token = authorization.replace("Bearer ", "").trim();

  if (!token) {
    throw new Error("NO_AUTH");
  }

  return await adminAuth.verifyIdToken(token);
}

async function getSheet(sheetName: string, range = "A:Z") {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!${range}`,
  });

  return response.data.values || [];
}

async function getUsuarioPorUid(firebaseUid: string) {
  const filas = await getSheet("USUARIOS", "A:Z");

  if (!filas.length) return null;

  const headers = filas[0].map((h: unknown) =>
    texto(h).toUpperCase()
  );

  const indices = {
    uid: ["UID", "AUTH_UID", "UID_FIREBASE"].map((h) =>
      headers.indexOf(h)
    ).find((i) => i !== -1) ?? -1,
    rol: headers.indexOf("ROL"),
    barberia: ["ID_BARBERIA", "BARBERIA_ID", "BARBERIAID"]
      .map((h) => headers.indexOf(h))
      .find((i) => i !== -1) ?? -1,
    nombre: ["NOMBRE", "NOMBRE_COMPLETO"].map((h) =>
      headers.indexOf(h)
    ).find((i) => i !== -1) ?? -1,
  };

  if (indices.uid === -1) return null;

  for (const fila of filas.slice(1)) {
    const uid = texto(fila[indices.uid]);

    if (uid === firebaseUid) {
      return {
        UID: uid,
        ROL:
          indices.rol !== -1
            ? texto(fila[indices.rol])
            : "",
        ID_BARBERIA:
          indices.barberia !== -1
            ? texto(fila[indices.barberia])
            : "",
        NOMBRE:
          indices.nombre !== -1
            ? texto(fila[indices.nombre])
            : "",
      };
    }
  }

  return null;
}

async function getBarberoPorUid(
  firebaseUid: string,
  barberiaId: string
) {
  const filas = await getSheet("BARBEROS", "A:Z");

  if (!filas.length) return null;

  const headers = filas[0].map((h: unknown) =>
    texto(h).toUpperCase()
  );

  const indiceId = headers.indexOf("ID_BARBERO");
  const indiceAuthUid = [
    "AUTH_UID",
    "UID",
  ]
    .map((h) => headers.indexOf(h))
    .find((i) => i !== -1) ?? -1;
  const indiceNombre = [
    "NOMBRE_COMPLETO",
    "NOMBRE",
  ]
    .map((h) => headers.indexOf(h))
    .find((i) => i !== -1) ?? -1;
  const indiceBarberia = [
    "ID_BARBERIA",
    "BARBERIA_ID",
    "BARBERIAID",
  ]
    .map((h) => headers.indexOf(h))
    .find((i) => i !== -1) ?? -1;

  if (
    indiceId === -1 ||
    indiceAuthUid === -1 ||
    indiceBarberia === -1
  ) {
    return null;
  }

  for (const fila of filas.slice(1)) {
    const authUid = texto(fila[indiceAuthUid]);
    const idBarberia = texto(fila[indiceBarberia]);

    if (
      authUid === firebaseUid &&
      idBarberia === barberiaId
    ) {
      return {
        ID_BARBERO: texto(fila[indiceId]),
        AUTH_UID: authUid,
        NOMBRE:
          indiceNombre !== -1
            ? texto(fila[indiceNombre])
            : "Barbero",
        ID_BARBERIA: idBarberia,
      };
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    // =====================================================
    // SEGURIDAD: IDENTIFICAR USUARIO REAL DESDE FIREBASE
    // =====================================================
    const firebaseUser = await getAuthenticatedUser(request);

    const usuario = await getUsuarioPorUid(
      firebaseUser.uid
    );

    if (!usuario) {
      return NextResponse.json(
        {
          ok: false,
          error: "Usuario no encontrado en USUARIOS.",
        },
        { status: 404 }
      );
    }

    const rol = normalizar(usuario.ROL);
    const barberiaIdUsuario = texto(
      usuario.ID_BARBERIA
    );

    if (!barberiaIdUsuario) {
      return NextResponse.json(
        {
          ok: false,
          error: "El usuario no tiene ID_BARBERIA.",
        },
        { status: 400 }
      );
    }

    const barberiaIdSolicitada = texto(
      request.nextUrl.searchParams.get("barberiaId")
    );

    // El navegador puede enviar la barbería, pero nunca decide
    // cuál puede consultar. La autoridad es USUARIOS + Firebase.
    if (
      barberiaIdSolicitada &&
      barberiaIdSolicitada !== barberiaIdUsuario
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "La barbería solicitada no coincide con la barbería del usuario.",
        },
        { status: 403 }
      );
    }

    // =====================================================
    // RESOLVER BARBERO SI EL USUARIO ES BARBERO
    // =====================================================
    let barberoActual: {
      ID_BARBERO: string;
      NOMBRE: string;
      ID_BARBERIA: string;
    } | null = null;

    if (rol === "barbero") {
      const barbero = await getBarberoPorUid(
        firebaseUser.uid,
        barberiaIdUsuario
      );

      if (!barbero) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Tu usuario está registrado como barbero, pero no existe un BARBEROS.AUTH_UID que coincida con tu UID de Firebase dentro de esta barbería.",
          },
          { status: 404 }
        );
      }

      barberoActual = {
        ID_BARBERO: barbero.ID_BARBERO,
        NOMBRE: barbero.NOMBRE,
        ID_BARBERIA: barbero.ID_BARBERIA,
      };
    } else if (
      rol !== "admin" &&
      rol !== "super_admin"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "No tienes permisos para consultar clientes.",
        },
        { status: 403 }
      );
    }

    // =====================================================
    // LEER DATOS
    // =====================================================
    const [clientesFilas, atencionesFilas, barberosFilas] =
      await Promise.all([
        getSheet("CLIENTES", "A:I"),
        getSheet("ATENCIONES", "A:K"),
        getSheet("BARBEROS", "A:Z"),
      ]);

    if (!clientesFilas.length) {
      return NextResponse.json({
        ok: true,
        clientes: [],
        total: 0,
        rol,
        barberoActual,
      });
    }

    // =====================================================
    // MAPA DE CLIENTES
    // =====================================================
    const encabezadosClientes = clientesFilas[0].map(
      (h: unknown) => texto(h).toUpperCase()
    );

    const idxCliente = (nombre: string) =>
      encabezadosClientes.indexOf(nombre);

    const iCliente = {
      id: idxCliente("ID_CLIENTE"),
      barberia: idxCliente("ID_BARBERIA"),
      nombre: idxCliente("NOMBRE"),
      telefono: idxCliente("TELEFONO"),
      rangoEdad: idxCliente("RANGO_EDAD"),
      primera: idxCliente("PRIMERA_ATENCION"),
      ultima: idxCliente("ULTIMA_ATENCION"),
      visitas: idxCliente("TOTAL_VISITAS"),
      gastado: idxCliente("TOTAL_GASTADO"),
    };

    const faltantesClientes = Object.entries(iCliente)
      .filter(([, index]) => index === -1)
      .map(([campo]) => campo);

    if (faltantesClientes.length) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Faltan columnas en CLIENTES: " +
            faltantesClientes.join(", "),
        },
        { status: 500 }
      );
    }

    // =====================================================
    // PROCESAR ATENCIONES
    // =====================================================
    let atenciones: any[] = [];

    if (atencionesFilas.length > 0) {
      const encabezadosAtenciones = atencionesFilas[0].map(
        (h: unknown) => texto(h).toUpperCase()
      );

      const idxAtencion = (nombre: string) =>
        encabezadosAtenciones.indexOf(nombre);

      const iAtencion = {
        id: idxAtencion("ID_ATENCION"),
        barberia: idxAtencion("ID_BARBERIA"),
        cliente: idxAtencion("ID_CLIENTE"),
        barbero: idxAtencion("ID_BARBERO"),
        nombreBarbero: idxAtencion("BARBERO"),
        servicio: idxAtencion("SERVICIO"),
        monto: idxAtencion("MONTO"),
        metodoPago: idxAtencion("METODO_PAGO"),
        tipo: idxAtencion("TIPO_ATENCION"),
        fecha: idxAtencion("FECHA"),
      };

      atenciones = atencionesFilas
        .slice(1)
        .map((fila) => ({
          ID_ATENCION:
            iAtencion.id !== -1
              ? texto(fila[iAtencion.id])
              : "",
          ID_BARBERIA:
            iAtencion.barberia !== -1
              ? texto(fila[iAtencion.barberia])
              : "",
          ID_CLIENTE:
            iAtencion.cliente !== -1
              ? texto(fila[iAtencion.cliente])
              : "",
          ID_BARBERO:
            iAtencion.barbero !== -1
              ? texto(fila[iAtencion.barbero])
              : "",
          BARBERO:
            iAtencion.nombreBarbero !== -1
              ? texto(fila[iAtencion.nombreBarbero])
              : "",
          SERVICIO:
            iAtencion.servicio !== -1
              ? texto(fila[iAtencion.servicio])
              : "",
          MONTO:
            iAtencion.monto !== -1
              ? Number(fila[iAtencion.monto] || 0)
              : 0,
          METODO_PAGO:
            iAtencion.metodoPago !== -1
              ? texto(fila[iAtencion.metodoPago])
              : "",
          TIPO_ATENCION:
            iAtencion.tipo !== -1
              ? texto(fila[iAtencion.tipo])
              : "",
          FECHA:
            iAtencion.fecha !== -1
              ? texto(fila[iAtencion.fecha])
              : "",
        }))
        .filter(
          (atencion) =>
            atencion.ID_CLIENTE !== ""
        );
    }

    // =====================================================
    // PRIMER FILTRO: SIEMPRE POR BARBERÍA
    // =====================================================
    const atencionesDeBarberia = atenciones.filter(
      (atencion) =>
        atencion.ID_BARBERIA === barberiaIdUsuario
    );

    // =====================================================
    // SEGUNDO FILTRO: BARBERO SOLO VE SUS ATENCIONES
    // =====================================================
    const atencionesPermitidas =
      rol === "barbero"
        ? atencionesDeBarberia.filter(
            (atencion) =>
              atencion.ID_BARBERO ===
              barberoActual?.ID_BARBERO
          )
        : atencionesDeBarberia;

    // =====================================================
    // MAPA DE BARBEROS
    // =====================================================
    const encabezadosBarberos =
      barberosFilas.length > 0
        ? barberosFilas[0].map((h: unknown) =>
            texto(h).toUpperCase()
          )
        : [];

    const iBarberoId = encabezadosBarberos.indexOf(
      "ID_BARBERO"
    );
    const iBarberoNombre = [
      "NOMBRE_COMPLETO",
      "NOMBRE",
    ]
      .map((h) => encabezadosBarberos.indexOf(h))
      .find((i) => i !== -1) ?? -1;
    const iBarberoEdad = [
      "RANGO_EDAD",
      "RANGO DE EDAD",
    ]
      .map((h) => encabezadosBarberos.indexOf(h))
      .find((i) => i !== -1) ?? -1;

    const barberos =
      barberosFilas.length > 1
        ? barberosFilas.slice(1).map((fila) => ({
            ID_BARBERO:
              iBarberoId !== -1
                ? texto(fila[iBarberoId])
                : "",
            NOMBRE:
              iBarberoNombre !== -1
                ? texto(fila[iBarberoNombre])
                : "",
            RANGO_EDAD:
              iBarberoEdad !== -1
                ? texto(fila[iBarberoEdad])
                : "",
          }))
        : [];

    const mapaBarberosPorId = new Map<
      string,
      any
    >();

    barberos.forEach((barbero) => {
      if (barbero.ID_BARBERO) {
        mapaBarberosPorId.set(
          barbero.ID_BARBERO,
          barbero
        );
      }
    });

    // =====================================================
    // PROCESAR CLIENTES
    // =====================================================
    const clientes = clientesFilas
      .slice(1)
      .map((fila) => {
        const idCliente = texto(
          fila[iCliente.id]
        );
        const idBarberia = texto(
          fila[iCliente.barberia]
        );

        if (!idCliente || idBarberia !== barberiaIdUsuario) {
          return null;
        }

        const atencionesCliente =
          atencionesPermitidas.filter(
            (atencion) =>
              atencion.ID_CLIENTE === idCliente
          );

        // Para un barbero, un cliente solo existe en su vista
        // si él realmente lo atendió.
        if (
          rol === "barbero" &&
          atencionesCliente.length === 0
        ) {
          return null;
        }

        const nombre = texto(
          fila[iCliente.nombre]
        );
        const telefono = texto(
          fila[iCliente.telefono]
        );
        const rangoEdad = texto(
          fila[iCliente.rangoEdad]
        );

        // =================================================
        // MÉTRICAS
        // Admin: conserva los totales globales de CLIENTES.
        // Barbero: calcula solamente sus propios datos.
        // =================================================
        let primeraAtencion = texto(
          fila[iCliente.primera]
        );
        let ultimaAtencion = texto(
          fila[iCliente.ultima]
        );
        let totalVisitas = Number(
          fila[iCliente.visitas] || 0
        );
        let totalGastado = Number(
          fila[iCliente.gastado] || 0
        );

        if (rol === "barbero") {
          const fechas = atencionesCliente
            .map((a) => a.FECHA)
            .filter(Boolean)
            .sort(
              (a, b) =>
                new Date(a).getTime() -
                new Date(b).getTime()
            );

          primeraAtencion =
            fechas[0] || "";
          ultimaAtencion =
            fechas[fechas.length - 1] || "";
          totalVisitas =
            atencionesCliente.length;
          totalGastado =
            atencionesCliente.reduce(
              (total, atencion) =>
                total +
                Number(atencion.MONTO || 0),
              0
            );
        }

        // =================================================
        // BARBEROS QUE LO ATENDIERON
        // =================================================
        const mapaBarberosCliente =
          new Map<string, any>();

        atencionesCliente.forEach((atencion) => {
          const idBarbero = texto(
            atencion.ID_BARBERO
          );
          const nombreBarbero = texto(
            atencion.BARBERO
          );

          const barberoEncontrado =
            idBarbero
              ? mapaBarberosPorId.get(idBarbero)
              : undefined;

          const idFinal =
            idBarbero ||
            `NOMBRE:${nombreBarbero}`;

          if (!mapaBarberosCliente.has(idFinal)) {
            mapaBarberosCliente.set(idFinal, {
              id: idBarbero,
              nombre:
                nombreBarbero ||
                barberoEncontrado?.NOMBRE ||
                "Sin nombre",
              rangoEdad:
                barberoEncontrado?.RANGO_EDAD ||
                "No registrado",
            });
          }
        });

        const barberosCliente = Array.from(
          mapaBarberosCliente.values()
        );

        // =================================================
        // HISTORIAL
        // =================================================
        const historial = atencionesCliente.map(
          (atencion) => ({
            idBarbero:
              atencion.ID_BARBERO,
            fecha: atencion.FECHA,
            barbero: atencion.BARBERO,
            servicio: atencion.SERVICIO,
            monto: atencion.MONTO,
            metodoPago: atencion.METODO_PAGO,
            tipoAtencion:
              atencion.TIPO_ATENCION,
          })
        );

        return {
          ID_CLIENTE: idCliente,
          ID_BARBERIA: idBarberia,
          NOMBRE: nombre,
          TELEFONO: telefono,
          RANGO_EDAD: rangoEdad,
          PRIMERA_ATENCION: primeraAtencion,
          ULTIMA_ATENCION: ultimaAtencion,
          TOTAL_VISITAS: totalVisitas,
          TOTAL_GASTADO: totalGastado,
          BARBEROS: barberosCliente,
          HISTORIAL: historial,
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      ok: true,
      clientes,
      total: clientes.length,
      rol,
      barberoActual,
    });
  } catch (error: any) {
    console.error(
      "GET /clientes/api:",
      error
    );

    const isAuthError =
      error?.message === "NO_AUTH" ||
      error?.code === "auth/id-token-expired" ||
      error?.code === "auth/argument-error" ||
      error?.code === "auth/id-token-revoked";

    return NextResponse.json(
      {
        ok: false,
        error: isAuthError
          ? "No autenticado o sesión expirada."
          : error?.message ||
            "No se pudieron cargar los clientes.",
      },
      {
        status: isAuthError ? 401 : 500,
      }
    );
  }
}