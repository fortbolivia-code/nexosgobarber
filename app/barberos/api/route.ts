import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { adminAuth } from "@/lib/firebase-admin";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

// =====================================================
// CONFIGURACIÓN
// =====================================================

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;

if (!SPREADSHEET_ID) {
  throw new Error("Falta GOOGLE_SHEETS_ID en .env.local");
}

// =====================================================
// SERVICE ACCOUNT
// =====================================================

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

if (!serviceAccount.client_email) {
  throw new Error(
    "serviceAccountKey.json no contiene client_email."
  );
}

if (!serviceAccount.private_key) {
  throw new Error(
    "serviceAccountKey.json no contiene private_key."
  );
}

// =====================================================
// GOOGLE SHEETS
// =====================================================

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

// =====================================================
// LEER GOOGLE SHEETS
// =====================================================

async function getSheet(sheetName: string) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
  });

  const rows = response.data.values || [];

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((header) =>
    String(header || "").trim()
  );

  return rows.slice(1).map((row) => {
    const item: Record<string, string> = {};

    headers.forEach((header, index) => {
      item[header] = String(row[index] ?? "");
    });

    return item;
  });
}

// =====================================================
// OBTENER USUARIO AUTENTICADO
// =====================================================

async function getAuthenticatedUser(
  request: NextRequest
) {
  const authorization =
    request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("NO_AUTH");
  }

  const token =
    authorization.replace("Bearer ", "");

  return await adminAuth.verifyIdToken(token);
}

// =====================================================
// OBTENER ID INTERNO DE UNA HOJA
// =====================================================

async function getSheetId(
  sheetName: string
) {
  const response =
    await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      fields: "sheets.properties",
    });

  const sheet =
    response.data.sheets?.find(
      (s) =>
        s.properties?.title ===
        sheetName
    );

  if (
    !sheet?.properties?.sheetId &&
    sheet?.properties?.sheetId !== 0
  ) {
    throw new Error(
      `No se encontró la hoja ${sheetName}`
    );
  }

  return sheet.properties.sheetId;
}

// =====================================================
// BUSCAR FILA POR UID
// =====================================================

async function buscarFilaPorValor(
  sheetName: string,
  columnLetter: string,
  value: string
): Promise<number | null> {

  const response =
    await sheets.spreadsheets.values.get({
      spreadsheetId:
        SPREADSHEET_ID,

      range:
        `${sheetName}!${columnLetter}:${columnLetter}`,
    });

  const rows =
    response.data.values || [];

  for (
    let i = 1;
    i < rows.length;
    i++
  ) {
    const actual =
      String(
        rows[i]?.[0] ?? ""
      ).trim();

    if (
      actual ===
      String(value).trim()
    ) {
      return i + 1;
    }
  }

  return null;
}

// =====================================================
// ELIMINAR FILA DE GOOGLE SHEETS
// =====================================================

async function eliminarFilaSheet(
  sheetName: string,
  rowNumber: number
) {
  const sheetId =
    await getSheetId(
      sheetName
    );

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId:
      SPREADSHEET_ID,

    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex:
                rowNumber - 1,
              endIndex:
                rowNumber,
            },
          },
        },
      ],
    },
  });
}

// =====================================================
// ESTADÍSTICAS
// =====================================================

function numero(valor: unknown) {
  const n = Number(valor);

  return Number.isFinite(n)
    ? n
    : 0;
}

function calcularEstadisticas(
  barberos: Record<string, string>[]
) {
  return {
    clientes:
      barberos.reduce(
        (total, barbero) =>
          total +
          numero(
            barbero.CLIENTES_ATENDIDOS
          ),
        0
      ),

    servicios:
      barberos.reduce(
        (total, barbero) =>
          total +
          numero(
            barbero.SERVICIOS_REALIZADOS
          ),
        0
      ),

    ingresos:
      barberos.reduce(
        (total, barbero) =>
          total +
          numero(
            barbero.INGRESOS
          ),
        0
      ),

    comisiones:
      barberos.reduce(
        (total, barbero) =>
          total +
          numero(
            barbero.COMISIONES
          ),
        0
      ),
  };
}

// =====================================================
// GET
// CARGAR BARBEROS + SERVICIOS + ESTADÍSTICAS
// =====================================================

export async function GET(
  request: NextRequest
) {
  try {

    // -------------------------------------------------
    // 1. AUTENTICAR
    // -------------------------------------------------

    const firebaseUser =
      await getAuthenticatedUser(
        request
      );

    // -------------------------------------------------
    // 2. BUSCAR USUARIO
    // -------------------------------------------------

    const usuarios =
      await getSheet("USUARIOS");

    const usuario =
      usuarios.find(
        (u) =>
          u.UID ===
            firebaseUser.uid ||
          u.AUTH_UID ===
            firebaseUser.uid
      );

    if (!usuario) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Usuario no encontrado",
        },
        { status: 404 }
      );
    }

    // -------------------------------------------------
    // 3. COMPROBAR ROL
    // -------------------------------------------------

    const rol =
      String(
        usuario.ROL || ""
      )
        .trim()
        .toLowerCase();

    if (
      rol !== "admin" &&
      rol !== "super_admin"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No tienes permisos",
        },
        { status: 403 }
      );
    }

    // -------------------------------------------------
    // 4. OBTENER BARBERÍA
    // -------------------------------------------------

    const barberiaId =
      usuario.ID_BARBERIA ||
      usuario.BARBERIAID ||
      usuario.ID_BARBERIA;

    if (!barberiaId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "El usuario no tiene una barbería asignada",
        },
        { status: 400 }
      );
    }

    // -------------------------------------------------
    // 5. LEER BARBEROS
    // -------------------------------------------------

    const todosLosBarberos =
      await getSheet("BARBEROS");

    const barberos =
      todosLosBarberos.filter(
        (barbero) =>
          barbero.ID_BARBERIA ===
          barberiaId
      );

    // -------------------------------------------------
    // 6. LEER SERVICIOS
    // -------------------------------------------------

    let todosLosServicios:
      Record<string, string>[] =
      [];

    try {
      todosLosServicios =
        await getSheet(
          "SERVICIOS"
        );
    } catch (error) {
      console.warn(
        "No se pudo leer SERVICIOS:",
        error
      );

      todosLosServicios = [];
    }

    const servicios =
      todosLosServicios.filter(
        (servicio) =>
          servicio.ID_BARBERIA ===
            barberiaId ||
          !servicio.ID_BARBERIA
      );

    // -------------------------------------------------
    // 7. ESTADÍSTICAS
    // -------------------------------------------------

    const estadisticas =
      calcularEstadisticas(
        barberos
      );

    // -------------------------------------------------
    // 8. RESPUESTA
    // -------------------------------------------------

    return NextResponse.json({
      ok: true,
      barberos,
      servicios,
      estadisticas,
    });

  } catch (error: any) {

    console.error(
      "GET /barberos/api:",
      error
    );

    if (
      error?.message ===
      "NO_AUTH"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No autenticado",
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          "No se pudieron cargar los datos",
      },
      { status: 500 }
    );
  }
}

// =====================================================
// POST
// CREAR BARBERO
// =====================================================

export async function POST(
  request: NextRequest
) {

  let nuevoUsuarioUid:
    string | null = null;

  let filaUsuarioCreada:
    number | null = null;

  let filaBarberoCreada:
    number | null = null;

  try {

    // -------------------------------------------------
    // 1. AUTENTICAR
    // -------------------------------------------------

    const firebaseUser =
      await getAuthenticatedUser(
        request
      );

    // -------------------------------------------------
    // 2. BUSCAR USUARIO ADMIN
    // -------------------------------------------------

    const usuarios =
      await getSheet("USUARIOS");

    const usuario =
      usuarios.find(
        (u) =>
          u.UID ===
            firebaseUser.uid ||
          u.AUTH_UID ===
            firebaseUser.uid
      );

    if (!usuario) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Usuario no encontrado",
        },
        { status: 404 }
      );
    }

    // -------------------------------------------------
    // 3. COMPROBAR ROL
    // -------------------------------------------------

    const rol =
      String(
        usuario.ROL || ""
      )
        .trim()
        .toLowerCase();

    if (
      rol !== "admin" &&
      rol !== "super_admin"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No tienes permisos para crear barberos",
        },
        { status: 403 }
      );
    }

    // -------------------------------------------------
    // 4. OBTENER BARBERÍA
    // -------------------------------------------------

    const barberiaId =
      usuario.ID_BARBERIA ||
      usuario.BARBERIAID;

    if (!barberiaId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "El usuario no tiene una barbería asignada",
        },
        { status: 400 }
      );
    }

    // -------------------------------------------------
    // 5. LEER BARBERÍA
    // -------------------------------------------------

    const barberias =
      await getSheet(
        "BARBERIAS"
      );

    const barberia =
      barberias.find(
        (b) =>
          b.ID_BARBERIA ===
          barberiaId
      );

    if (!barberia) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Barbería no encontrada",
        },
        { status: 404 }
      );
    }

    // -------------------------------------------------
    // 6. LEER BARBEROS
    // -------------------------------------------------

    const barberos =
      await getSheet(
        "BARBEROS"
      );

    const barberosBarberia =
      barberos.filter(
        (b) =>
          b.ID_BARBERIA ===
            barberiaId &&
          String(
            b.ESTADO || ""
          )
            .trim()
            .toLowerCase() ===
            "activo"
      );

    // -------------------------------------------------
    // 7. COMPROBAR LÍMITE
    // -------------------------------------------------

    const limite =
      Number(
        barberia.LIMITE_BARBEROS ||
        barberia.LIMITE ||
        0
      );

    if (
      limite > 0 &&
      barberosBarberia.length >=
        limite
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            `Has alcanzado el límite de ${limite} barberos.`,
        },
        { status: 409 }
      );
    }

    // -------------------------------------------------
    // 8. DATOS DEL FORMULARIO
    // -------------------------------------------------

    const body =
      await request.json();

    const nombre =
      body.nombre;

    const telefono =
      body.telefono;

    const direccion =
      body.direccion;

    const fechaNacimiento =
      body.fechaNacimiento;

    const cedula =
      body.cedula;

    const fechaIngreso =
      body.fechaIngreso;

    const porcentajeComision =
      body.porcentajeComision ??
      body.comision ??
      "50";

    const correo =
      body.correo ??
      body.email;

    const password =
      body.password;

    const fotoUrl =
      body.fotoUrl ??
      body.foto_url ??
      "";

    // -------------------------------------------------
    // 9. VALIDAR NOMBRE
    // -------------------------------------------------

    if (
      !nombre ||
      !String(nombre).trim()
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "El nombre es obligatorio",
        },
        { status: 400 }
      );
    }

    // -------------------------------------------------
    // 10. VALIDAR CÉDULA
    // -------------------------------------------------

    if (
      !cedula ||
      !String(cedula).trim()
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "La cédula es obligatoria",
        },
        { status: 400 }
      );
    }

    // -------------------------------------------------
    // 11. VALIDAR CORREO
    // -------------------------------------------------

    if (
      !correo ||
      !String(correo).trim()
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "El correo es obligatorio",
        },
        { status: 400 }
      );
    }

    // -------------------------------------------------
    // 12. VALIDAR PASSWORD
    // -------------------------------------------------

    if (!password) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "La contraseña es obligatoria",
        },
        { status: 400 }
      );
    }

    if (
      String(password).length < 6
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "La contraseña debe tener al menos 6 caracteres",
        },
        { status: 400 }
      );
    }

    // -------------------------------------------------
    // 13. VALIDAR COMISIÓN
    // -------------------------------------------------

    const comision =
      Number(
        porcentajeComision
      );

    if (
      Number.isNaN(comision) ||
      comision < 0 ||
      comision > 100
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "La comisión debe estar entre 0 y 100",
        },
        { status: 400 }
      );
    }

    // -------------------------------------------------
    // 14. NORMALIZAR DATOS
    // -------------------------------------------------

    const nombreNormalizado =
      String(nombre).trim();

    const cedulaNormalizada =
      String(cedula).trim();

    const correoNormalizado =
      String(correo)
        .trim()
        .toLowerCase();

    // -------------------------------------------------
    // 15. COMPROBAR CÉDULA
    // -------------------------------------------------

    const columnaCedulaExiste =
      barberos.some(
        (b) =>
          Object.prototype.hasOwnProperty.call(
            b,
            "CEDULA"
          )
      );

    if (
      columnaCedulaExiste
    ) {

      const cedulaExiste =
        barberos.some(
          (b) =>
            String(
              b.CEDULA || ""
            ).trim() ===
            cedulaNormalizada
        );

      if (cedulaExiste) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Ya existe un barbero con esa cédula",
          },
          { status: 409 }
        );
      }
    }

    // -------------------------------------------------
    // 16. COMPROBAR CORREO EN BARBEROS
    // -------------------------------------------------

    const correoExisteBarberos =
      barberos.some(
        (b) => {

          const usuarioHoja =
            String(
              b.USUARIO ||
              b.CORREO ||
              ""
            )
              .trim()
              .toLowerCase();

          return (
            usuarioHoja ===
            correoNormalizado
          );
        }
      );

    if (
      correoExisteBarberos
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Ese correo ya está registrado",
        },
        { status: 409 }
      );
    }

    // -------------------------------------------------
    // 17. COMPROBAR CORREO EN USUARIOS
    // -------------------------------------------------
    //
    // Esto es importante ahora que los barberos
    // también estarán registrados en USUARIOS.
    //
    // -------------------------------------------------

    const correoExisteUsuarios =
      usuarios.some(
        (u) =>
          String(
            u.CORREO ||
            u.EMAIL ||
            ""
          )
            .trim()
            .toLowerCase() ===
          correoNormalizado
      );

    if (
      correoExisteUsuarios
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Ese correo ya existe en USUARIOS",
        },
        { status: 409 }
      );
    }

    // -------------------------------------------------
    // 18. CREAR USUARIO EN FIREBASE
    // -------------------------------------------------

    let nuevoUsuario;

    try {

      nuevoUsuario =
        await adminAuth.createUser({
          email:
            correoNormalizado,

          password:
            String(password),

          displayName:
            nombreNormalizado,
        });

      nuevoUsuarioUid =
        nuevoUsuario.uid;

    } catch (
      firebaseError: any
    ) {

      console.error(
        "FIREBASE CREATE USER:",
        firebaseError
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            firebaseError?.message ||
            "No se pudo crear la cuenta",
        },
        { status: 400 }
      );
    }

    // -------------------------------------------------
    // 19. CREAR ID BARBERO
    // -------------------------------------------------

    const idBarbero =
      `BARB-${Date.now()}`;

    const fechaCreacion =
      new Date().toISOString();

    // -------------------------------------------------
    // 20. CREAR FILA USUARIOS
    // -------------------------------------------------
    //
    // ORDEN:
    //
    // UID
    // NOMBRE
    // CORREO
    // ROL
    // ID_BARBERIA
    // ESTADO
    //
    // -------------------------------------------------

    const nuevaFilaUsuario = [
      nuevoUsuario.uid,
      nombreNormalizado,
      correoNormalizado,
      "barbero",
      barberiaId,
      "activo",
    ];

    // -------------------------------------------------
    // 21. GUARDAR EN USUARIOS
    // -------------------------------------------------

    try {

      await sheets.spreadsheets.values.append({
        spreadsheetId:
          SPREADSHEET_ID,

        range:
          "USUARIOS!A:F",

        valueInputOption:
          "USER_ENTERED",

        insertDataOption:
          "INSERT_ROWS",

        requestBody: {
          values: [
            nuevaFilaUsuario,
          ],
        },
      });

      // Buscar exactamente la fila creada
      // utilizando el UID recién creado.

      filaUsuarioCreada =
        await buscarFilaPorValor(
          "USUARIOS",
          "A",
          nuevoUsuario.uid
        );

    } catch (
      usuariosError: any
    ) {

      console.error(
        "ERROR CREANDO USUARIO EN USUARIOS:",
        usuariosError
      );

      // ------------------------------------------------
      // ROLLBACK FIREBASE
      // ------------------------------------------------

      if (
        nuevoUsuarioUid
      ) {

        try {

          await adminAuth.deleteUser(
            nuevoUsuarioUid
          );

          nuevoUsuarioUid =
            null;

        } catch (
          rollbackFirebaseError
        ) {

          console.error(
            "ERROR ROLLBACK FIREBASE:",
            rollbackFirebaseError
          );
        }
      }

      return NextResponse.json(
        {
          ok: false,
          error:
            "No se pudo crear el registro en USUARIOS. La cuenta de Firebase fue revertida.",
        },
        { status: 500 }
      );
    }

    // -------------------------------------------------
    // 22. CREAR FILA BARBEROS
    // -------------------------------------------------
    //
    // ORDEN EXACTO:
    //
    // ID_BARBERO
    // ID_BARBERIA
    // AUTH_UID
    // NOMBRE
    // TELEFONO
    // DIRECCION
    // FECHA_NACIMIENTO
    // FECHA_INGRESO
    // PORCENTAJE_COMISION
    // USUARIO
    // ROL
    // ESTADO
    // FOTO_URL
    // FECHA_CREACION
    //
    // -------------------------------------------------

    const nuevaFilaBarbero = [
      idBarbero,

      barberiaId,

      nuevoUsuario.uid,

      nombreNormalizado,

      telefono
        ? String(
            telefono
          ).trim()
        : "",

      direccion
        ? String(
            direccion
          ).trim()
        : "",

      fechaNacimiento
        ? String(
            fechaNacimiento
          )
        : "",

      fechaIngreso
        ? String(
            fechaIngreso
          )
        : "",

      comision,

      correoNormalizado,

      "barbero",

      "activo",

      fotoUrl
        ? String(
            fotoUrl
          )
        : "",

      fechaCreacion,
    ];

    // -------------------------------------------------
    // 23. GUARDAR EN BARBEROS
    // -------------------------------------------------

    try {

      await sheets.spreadsheets.values.append({
        spreadsheetId:
          SPREADSHEET_ID,

        range:
          "BARBEROS!A:N",

        valueInputOption:
          "USER_ENTERED",

        insertDataOption:
          "INSERT_ROWS",

        requestBody: {
          values: [
            nuevaFilaBarbero,
          ],
        },
      });

      // Buscar exactamente la fila creada
      // usando el ID_BARBERO.

      filaBarberoCreada =
        await buscarFilaPorValor(
          "BARBEROS",
          "A",
          idBarbero
        );

    } catch (
      barberosError: any
    ) {

      console.error(
        "ERROR CREANDO BARBERO EN BARBEROS:",
        barberosError
      );

      // ===============================================
      // ROLLBACK USUARIOS
      // ===============================================

      if (
        filaUsuarioCreada
      ) {

        try {

          await eliminarFilaSheet(
            "USUARIOS",
            filaUsuarioCreada
          );

        } catch (
          rollbackUsuariosError
        ) {

          console.error(
            "ERROR ROLLBACK USUARIOS:",
            rollbackUsuariosError
          );
        }
      }

      // ===============================================
      // ROLLBACK FIREBASE
      // ===============================================

      if (
        nuevoUsuarioUid
      ) {

        try {

          await adminAuth.deleteUser(
            nuevoUsuarioUid
          );

          nuevoUsuarioUid =
            null;

        } catch (
          rollbackFirebaseError
        ) {

          console.error(
            "ERROR ROLLBACK FIREBASE:",
            rollbackFirebaseError
          );
        }
      }

      return NextResponse.json(
        {
          ok: false,
          error:
            "No se pudo guardar el barbero. Se revirtió el registro de USUARIOS y la cuenta de Firebase.",
        },
        { status: 500 }
      );
    }

    // -------------------------------------------------
    // 24. TODO CORRECTO
    // -------------------------------------------------

    return NextResponse.json(
      {
        ok: true,

        mensaje:
          "Barbero creado correctamente",

        uid:
          nuevoUsuario.uid,

        usuario: {
          uid:
            nuevoUsuario.uid,

          nombre:
            nombreNormalizado,

          correo:
            correoNormalizado,

          rol:
            "barbero",

          barberiaId:
            barberiaId,

          estado:
            "activo",
        },

        barbero: {
          id:
            idBarbero,

          uid:
            nuevoUsuario.uid,

          nombre:
            nombreNormalizado,

          correo:
            correoNormalizado,

          barberiaId:
            barberiaId,

          estado:
            "activo",
        },
      },
      { status: 201 }
    );

  } catch (
    error: any
  ) {

    console.error(
      "POST /barberos/api:",
      error
    );

    // =================================================
    // ROLLBACK DE EMERGENCIA
    // =================================================

    if (
      filaBarberoCreada
    ) {

      try {

        await eliminarFilaSheet(
          "BARBEROS",
          filaBarberoCreada
        );

      } catch (
        rollbackBarberosError
      ) {

        console.error(
          "ERROR ROLLBACK BARBEROS:",
          rollbackBarberosError
        );
      }
    }

    if (
      filaUsuarioCreada
    ) {

      try {

        await eliminarFilaSheet(
          "USUARIOS",
          filaUsuarioCreada
        );

      } catch (
        rollbackUsuariosError
      ) {

        console.error(
          "ERROR ROLLBACK USUARIOS:",
          rollbackUsuariosError
        );
      }
    }

    if (
      nuevoUsuarioUid
    ) {

      try {

        await adminAuth.deleteUser(
          nuevoUsuarioUid
        );

      } catch (
        rollbackFirebaseError
      ) {

        console.error(
          "ERROR ROLLBACK FIREBASE:",
          rollbackFirebaseError
        );
      }
    }

    if (
      error?.message ===
      "NO_AUTH"
    ) {

      return NextResponse.json(
        {
          ok: false,
          error:
            "No autenticado",
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          "Error interno del servidor",
      },
      { status: 500 }
    );
  }
}