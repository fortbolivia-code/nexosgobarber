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

function normalizarTelefono(valor: unknown) {
  return String(valor ?? "")
    .replace(/\D/g, "")
    .trim();
}

function texto(valor: unknown) {
  return String(valor ?? "").trim();
}

async function getSheet(sheetName: string) {
  const response =
    await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:Z`,
    });

  const rows = response.data.values || [];

  if (!rows.length) return [];

  const headers = rows[0].map((header) =>
    texto(header)
  );

  return rows.slice(1).map((row) => {
    const item: Record<string, string> = {};

    headers.forEach((header, index) => {
      item[header] = texto(row[index]);
    });

    return item;
  });
}

async function getAuthenticatedUser(
  request: NextRequest
) {
  const authorization =
    request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("NO_AUTH");
  }

  const token = authorization.replace(
    "Bearer ",
    ""
  );

  return await adminAuth.verifyIdToken(token);
}

async function getUsuarioPorUid(firebaseUid: string) {
  const usuarios = await getSheet("USUARIOS");

  return (
    usuarios.find((usuario) => {
      const uid = texto(
        usuario.UID || usuario.AUTH_UID
      );

      return uid === firebaseUid;
    }) || null
  );
}

async function getBarberoPorUid(firebaseUid: string) {
  const barberos = await getSheet("BARBEROS");

  return (
    barberos.find((barbero) => {
      const authUid = texto(
        barbero.AUTH_UID ||
          barbero.UID ||
          barbero.auth_uid ||
          barbero.uid
      );

      return authUid === firebaseUid;
    }) || null
  );
}

/*
 * ============================================================
 * GET
 *
 * Devuelve los barberos que el usuario puede usar como responsable.
 *
 * BARBERO:
 *   solamente devuelve SU propio registro.
 *
 * ADMIN / SUPER_ADMIN:
 *   devuelve los barberos de SU barbería.
 * ============================================================
 */
export async function GET(request: NextRequest) {
  try {
    const firebaseUser =
      await getAuthenticatedUser(request);

    const usuario =
      await getUsuarioPorUid(firebaseUser.uid);

    if (!usuario) {
      return NextResponse.json(
        {
          ok: false,
          error: "Usuario no encontrado en USUARIOS.",
        },
        { status: 404 }
      );
    }

    const rol = texto(usuario.ROL).toLowerCase();
    const barberiaId = texto(
      usuario.ID_BARBERIA ||
        usuario.BARBERIA_ID ||
        usuario.BARBERIAID
    );

    if (!barberiaId) {
      return NextResponse.json(
        {
          ok: false,
          error: "El usuario no tiene ID_BARBERIA.",
        },
        { status: 400 }
      );
    }

    const todosLosBarberos =
      await getSheet("BARBEROS");

    if (rol === "barbero") {
      const barbero =
        todosLosBarberos.find((item) => {
          const itemUid = texto(
            item.AUTH_UID ||
              item.UID ||
              item.auth_uid ||
              item.uid
          );

          const itemBarberia = texto(
            item.ID_BARBERIA ||
              item.BARBERIA_ID ||
              item.BARBERIAID
          );

          return (
            itemUid === firebaseUser.uid &&
            itemBarberia === barberiaId
          );
        });

      if (!barbero) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Tu usuario está registrado como barbero, pero no existe un BARBEROS.AUTH_UID que coincida con tu UID de Firebase.",
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        ok: true,
        barberos: [barbero],
        barberoActual: {
          ID_BARBERO: texto(
            barbero.ID_BARBERO
          ),
          AUTH_UID: texto(
            barbero.AUTH_UID ||
              barbero.UID
          ),
          NOMBRE: texto(
            barbero.NOMBRE_COMPLETO ||
              barbero.NOMBRE
          ),
          ID_BARBERIA: barberiaId,
        },
      });
    }

    if (
      rol !== "admin" &&
      rol !== "super_admin"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "No tienes permisos.",
        },
        { status: 403 }
      );
    }

    const barberos =
      todosLosBarberos.filter((barbero) => {
        const itemBarberia = texto(
          barbero.ID_BARBERIA ||
            barbero.BARBERIA_ID ||
            barbero.BARBERIAID
        );

        return itemBarberia === barberiaId;
      });

    return NextResponse.json({
      ok: true,
      barberos,
    });
  } catch (error: any) {
    console.error(
      "GET /atencion-pagos/api:",
      error
    );

    const status =
      error?.message === "NO_AUTH" ? 401 : 500;

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message === "NO_AUTH"
            ? "No autenticado."
            : error?.message ||
              "No se pudieron cargar los barberos.",
      },
      { status }
    );
  }
}

/*
 * ============================================================
 * POST
 * REGISTRAR ATENCIÓN + CLIENTE
 *
 * La identidad del barbero NO se toma como autoridad desde el
 * navegador. Para un usuario barbero se obtiene desde Firebase UID
 * y BARBEROS.AUTH_UID.
 * ============================================================
 */
export async function POST(
  request: NextRequest
) {
  try {
    const firebaseUser =
      await getAuthenticatedUser(request);

    const usuario =
      await getUsuarioPorUid(firebaseUser.uid);

    if (!usuario) {
      return NextResponse.json(
        {
          ok: false,
          error: "Usuario no encontrado en USUARIOS.",
        },
        { status: 404 }
      );
    }

    const rol = texto(usuario.ROL).toLowerCase();

    const barberiaIdUsuario = texto(
      usuario.ID_BARBERIA ||
        usuario.BARBERIA_ID ||
        usuario.BARBERIAID
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

    const body = await request.json();

    const barberiaIdSolicitada = texto(
      body.barberiaId
    );

    if (
      barberiaIdSolicitada &&
      barberiaIdSolicitada !== barberiaIdUsuario
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "La barbería enviada no coincide con la barbería del usuario.",
        },
        { status: 403 }
      );
    }

    const barberiaId = barberiaIdUsuario;

    const clienteIdRecibido = texto(
      body.clienteId
    );

    const nombre = texto(body.nombre);
    const telefono = normalizarTelefono(
      body.telefono
    );
    const rangoEdad = texto(
      body.rangoEdad
    );

    const servicioId = texto(
      body.servicioId
    );
    const servicioNombre = texto(
      body.servicioNombre
    );
    const metodoPago = texto(
      body.metodoPago
    );
    const tipoAtencion = texto(
      body.tipoAtencion
    );
    const fecha = texto(body.fecha);
    const reservaId = texto(body.reservaId);

    const monto = Number(body.monto);

    if (!nombre) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "El nombre del cliente es obligatorio.",
        },
        { status: 400 }
      );
    }

    if (!telefono) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "El teléfono es obligatorio.",
        },
        { status: 400 }
      );
    }

    if (!/^\d+$/.test(telefono)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "El teléfono solo puede contener números.",
        },
        { status: 400 }
      );
    }

    if (!rangoEdad) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "El rango de edad es obligatorio.",
        },
        { status: 400 }
      );
    }

    if (!servicioId || !servicioNombre) {
      return NextResponse.json(
        {
          ok: false,
          error: "El servicio es obligatorio.",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(monto) ||
      monto <= 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "El monto debe ser un número mayor a 0.",
        },
        { status: 400 }
      );
    }

    if (!metodoPago) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Selecciona un método de pago.",
        },
        { status: 400 }
      );
    }

    if (!tipoAtencion) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "El tipo de atención es obligatorio.",
        },
        { status: 400 }
      );
    }

    if (!fecha) {
      return NextResponse.json(
        {
          ok: false,
          error: "La fecha es obligatoria.",
        },
        { status: 400 }
      );
    }

    /*
     * ========================================================
     * RESOLVER RESPONSABLE REAL
     * ========================================================
     */
    let barberoId = "";
    let barberoNombre = "";

    if (rol === "barbero") {
      const barbero =
        await getBarberoPorUid(
          firebaseUser.uid
        );

      if (!barbero) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "No existe un barbero con AUTH_UID igual al UID de Firebase del usuario.",
          },
          { status: 400 }
        );
      }

      const barberiaDelBarbero = texto(
        barbero.ID_BARBERIA ||
          barbero.BARBERIA_ID ||
          barbero.BARBERIAID
      );

      if (
        barberiaDelBarbero !==
        barberiaIdUsuario
      ) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "El barbero no pertenece a la barbería de su usuario.",
          },
          { status: 403 }
        );
      }

      barberoId = texto(
        barbero.ID_BARBERO
      );

      barberoNombre = texto(
        barbero.NOMBRE_COMPLETO ||
          barbero.NOMBRE
      );
    } else if (
      rol === "admin" ||
      rol === "super_admin"
    ) {
      /*
       * Admin puede registrar una atención como responsable.
       * Se mantiene compatibilidad con tu comportamiento anterior.
       */
      barberoId = texto(
        body.barberoId
      );
      barberoNombre = texto(
        body.barberoNombre
      );

      if (!barberoId) {
        barberoId =
          firebaseUser.uid;
      }

      if (!barberoNombre) {
        barberoNombre =
          texto(usuario.NOMBRE) ||
          "Administrador";
      }
    } else {
      return NextResponse.json(
        {
          ok: false,
          error: "Rol de usuario no permitido.",
        },
        { status: 403 }
      );
    }

    if (!barberoId || !barberoNombre) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No se pudo identificar al responsable que realiza la atención.",
        },
        { status: 400 }
      );
    }

    /*
     * ========================================================
     * CLIENTES
     * ========================================================
     */
    const clientesResponse =
      await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "CLIENTES!A:I",
      });

    const filasClientes =
      clientesResponse.data.values || [];

    let clienteId = "";
    let filaClienteEncontrado = -1;

    if (filasClientes.length > 1) {
      for (
        let i = 1;
        i < filasClientes.length;
        i++
      ) {
        const fila = filasClientes[i];

        const barberiaExistente = texto(
          fila[1]
        );

        const telefonoExistente =
          normalizarTelefono(fila[3]);

        if (
          barberiaExistente === barberiaId &&
          telefonoExistente === telefono
        ) {
          clienteId = texto(fila[0]);
          filaClienteEncontrado = i + 1;
          break;
        }
      }
    }

    /*
     * Cliente nuevo
     */
    if (!clienteId) {
      clienteId =
        clienteIdRecibido ||
        "CLI-" + Date.now();

      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "CLIENTES!A:I",
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [
            [
              clienteId,
              barberiaId,
              nombre,
              telefono,
              rangoEdad,
              fecha,
              fecha,
              1,
              monto,
            ],
          ],
        },
      });
    } else {
      /*
       * Cliente existente
       */
      const fila =
        filasClientes[
          filaClienteEncontrado - 1
        ];

      const primeraAtencion =
        texto(fila[5]) || fecha;

      const totalVisitasActual = Number(
        fila[7] ?? 0
      );

      const totalGastadoActual = Number(
        fila[8] ?? 0
      );

      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `CLIENTES!A${filaClienteEncontrado}:I${filaClienteEncontrado}`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [
            [
              clienteId,
              barberiaId,
              nombre,
              telefono,
              rangoEdad,
              primeraAtencion,
              fecha,
              totalVisitasActual + 1,
              totalGastadoActual + monto,
            ],
          ],
        },
      });
    }

    /*
     * ========================================================
     * ATENCIÓN
     * ========================================================
     *
     * ATENCIONES:
     * A ID_ATENCION
     * B ID_BARBERIA
     * C ID_CLIENTE
     * D ID_BARBERO
     * E BARBERO
     * F ID_SERVICIO
     * G SERVICIO
     * H MONTO
     * I METODO_PAGO
     * J TIPO_ATENCION
     * K FECHA
     */
    const atencionId =
      "ATE-" + Date.now();

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "ATENCIONES!A:K",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [
          [
            atencionId,
            barberiaId,
            clienteId,
            barberoId,
            barberoNombre,
            servicioId,
            servicioNombre,
            monto,
            metodoPago,
            tipoAtencion,
            fecha,
          ],
        ],
      },
    });

    /*
     * Si la atención viene de una reserva, intentamos marcarla
     * como atendida sin romper el registro si la estructura de
     * RESERVAS es diferente.
     */
    if (reservaId) {
      try {
        const reservasResponse =
          await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: "RESERVAS!A:Z",
          });

        const reservas =
          reservasResponse.data.values || [];

        if (reservas.length > 1) {
          const headers = reservas[0].map(
            (header) =>
              texto(header).toUpperCase()
          );

          const indiceId = headers.indexOf(
            "ID_RESERVA"
          );
          const indiceEstado = headers.indexOf(
            "ESTADO"
          );

          if (
            indiceId !== -1 &&
            indiceEstado !== -1
          ) {
            for (
              let i = 1;
              i < reservas.length;
              i++
            ) {
              if (
                texto(
                  reservas[i][indiceId]
                ) === reservaId
              ) {
                const columna =
                  String.fromCharCode(
                    65 + indiceEstado
                  );

                await sheets.spreadsheets.values.update(
                  {
                    spreadsheetId:
                      SPREADSHEET_ID,
                    range: `RESERVAS!${columna}${i + 1}`,
                    valueInputOption:
                      "USER_ENTERED",
                    requestBody: {
                      values: [["Atendida"]],
                    },
                  }
                );

                break;
              }
            }
          }
        }
      } catch (error) {
        console.warn(
          "No se pudo actualizar el estado de la reserva:",
          error
        );
      }
    }

    return NextResponse.json({
      ok: true,
      mensaje:
        "Atención registrada correctamente.",
      atencion: {
        ID_ATENCION: atencionId,
        ID_BARBERIA: barberiaId,
        ID_CLIENTE: clienteId,
        ID_BARBERO: barberoId,
        BARBERO: barberoNombre,
        ID_SERVICIO: servicioId,
        SERVICIO: servicioNombre,
        MONTO: monto,
        METODO_PAGO: metodoPago,
        TIPO_ATENCION: tipoAtencion,
        FECHA: fecha,
      },
      cliente: {
        ID_CLIENTE: clienteId,
        NOMBRE: nombre,
        TELEFONO: telefono,
        RANGO_EDAD: rangoEdad,
      },
    });
  } catch (error: any) {
    console.error(
      "POST /atencion-pagos/api:",
      error
    );

    const status =
      error?.message === "NO_AUTH" ? 401 : 500;

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message === "NO_AUTH"
            ? "No autenticado."
            : error?.message ||
              "No se pudo registrar la atención.",
      },
      { status }
    );
  }
}