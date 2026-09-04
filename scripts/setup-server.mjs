import "dotenv/config";
import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits, OverwriteType } from "discord.js";

const ALUNO_ROLE_ID = process.env.DISCORD_VERIFIED_ROLE_ID;
const TRANSCENDER_ROLE_ID = process.env.DISCORD_TRANSCENDER_ROLE_ID;
const STAFF_ROLE_ID = "1545496217360928869"; // multiplicador
const BOT_ROLE_ID = "1545495131975720964"; // 42naufragos (managed role do bot)
const OWNER_USER_ID = "501196386226667531"; // dbessa

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function overwritesFor(
  guild,
  {
    staffOnly = false,
    publicRead = false,
    botOnlyWrite = false,
    restrictedRoleId = null,
    restrictedUserId = null,
    denyRoleIds = [],
  } = {}
) {
  const everyone = guild.roles.everyone.id;
  const byId = new Map();

  function merge(id, { allow = [], deny = [], type = OverwriteType.Role }) {
    const entry = byId.get(id) ?? { id, type, allow: new Set(), deny: new Set() };
    allow.forEach((bit) => entry.allow.add(bit));
    deny.forEach((bit) => entry.deny.add(bit));
    byId.set(id, entry);
  }

  if (restrictedUserId) {
    merge(everyone, { deny: [PermissionFlagsBits.ViewChannel] });
    merge(ALUNO_ROLE_ID, { deny: [PermissionFlagsBits.ViewChannel] });
    merge(restrictedUserId, { allow: [PermissionFlagsBits.ViewChannel], type: OverwriteType.Member });
  } else if (staffOnly) {
    merge(everyone, { deny: [PermissionFlagsBits.ViewChannel] });
    merge(ALUNO_ROLE_ID, { deny: [PermissionFlagsBits.ViewChannel] });
    merge(STAFF_ROLE_ID, { allow: [PermissionFlagsBits.ViewChannel] });
  } else if (restrictedRoleId) {
    merge(everyone, { deny: [PermissionFlagsBits.ViewChannel] });
    merge(restrictedRoleId, { allow: [PermissionFlagsBits.ViewChannel] });
  } else if (publicRead) {
    merge(everyone, { allow: [PermissionFlagsBits.ViewChannel] });
  } else {
    merge(everyone, { deny: [PermissionFlagsBits.ViewChannel] });
    merge(ALUNO_ROLE_ID, { allow: [PermissionFlagsBits.ViewChannel] });
  }

  if (botOnlyWrite) {
    merge(everyone, { deny: [PermissionFlagsBits.SendMessages] });
    merge(ALUNO_ROLE_ID, { deny: [PermissionFlagsBits.SendMessages] });
  }

  // Deny explícito de role vence o allow de @everyone/publicRead (ordem de resolução do Discord).
  for (const roleId of denyRoleIds) {
    merge(roleId, { deny: [PermissionFlagsBits.ViewChannel] });
  }

  // Sempre garante que o bot enxerga e gerencia o canal, mesmo quando @everyone é negado.
  // ManageRoles não pode ser delegado via overwrite de canal (Discord rejeita a criação).
  merge(BOT_ROLE_ID, {
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ManageChannels,
    ],
  });

  return [...byId.values()].map((e) => ({
    id: e.id,
    type: e.type,
    allow: [...e.allow],
    deny: [...e.deny],
  }));
}

const structure = [
  {
    name: "INÍCIO",
    noVoice: true,
    channels: [
      { name: "regras", publicRead: true, botOnlyWrite: true },
      { name: "anúncios", botOnlyWrite: true },
      {
        name: "verificação",
        publicRead: true,
        botOnlyWrite: true,
        denyRoleIds: [ALUNO_ROLE_ID],
      },
    ],
  },
  {
    name: "GERAL",
    voiceLabel: "Geral",
    channels: [{ name: "geral" }, { name: "off-topic" }, { name: "memes" }],
  },
  {
    name: "TRANSCENDERS",
    voiceLabel: "Transcenders",
    restrictedRoleId: TRANSCENDER_ROLE_ID,
    channels: [{ name: "geral-transcenders", restrictedRoleId: TRANSCENDER_ROLE_ID }],
  },
  {
    name: "CURSUS",
    voiceLabel: "Cursus",
    channels: [{ name: "geral-cursus" }],
  },
  {
    name: "PROJETOS",
    voiceLabel: "Projetos",
    channels: [
      { name: "buscando-dupla" },
      { name: "showcase" },
      { name: "mural-avaliacoes", botOnlyWrite: true, restrictedUserId: OWNER_USER_ID },
    ],
  },
  {
    name: "STAFF",
    voiceLabel: "Staff",
    staffOnly: true,
    channels: [{ name: "staff-geral", staffOnly: true }, { name: "logs", staffOnly: true }],
  },
];

const VOICE_CHANNELS_PER_CATEGORY = 3;

for (const cat of structure) {
  if (cat.noVoice) continue;
  for (let i = 1; i <= VOICE_CHANNELS_PER_CATEGORY; i++) {
    cat.channels.push({
      name: `${cat.voiceLabel} ${String(i).padStart(2, "0")}`,
      voice: true,
      staffOnly: cat.staffOnly,
      publicRead: cat.channels.some((c) => c.publicRead),
      restrictedRoleId: cat.restrictedRoleId ?? null,
    });
  }
}

client.once("ready", async () => {
  const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
  const existingChannels = await guild.channels.fetch();

  for (const cat of structure) {
    let category = existingChannels.find(
      (c) => c.type === ChannelType.GuildCategory && c.name === cat.name
    );

    const categoryOverwrites = overwritesFor(guild, {
      staffOnly: cat.staffOnly,
      restrictedRoleId: cat.restrictedRoleId,
    });

    if (!category) {
      category = await guild.channels.create({
        name: cat.name,
        type: ChannelType.GuildCategory,
        permissionOverwrites: categoryOverwrites,
      });
      console.log(`Categoria criada: ${cat.name}`);
    } else {
      await category.permissionOverwrites.set(categoryOverwrites);
      console.log(`Categoria já existe, overwrites atualizados: ${cat.name}`);
    }

    for (const ch of cat.channels) {
      const channelType = ch.voice ? ChannelType.GuildVoice : ChannelType.GuildText;
      const overwrites = overwritesFor(guild, {
        staffOnly: ch.staffOnly,
        publicRead: ch.publicRead,
        botOnlyWrite: ch.voice ? false : ch.botOnlyWrite,
        restrictedRoleId: ch.restrictedRoleId,
        restrictedUserId: ch.restrictedUserId,
        denyRoleIds: ch.denyRoleIds,
      });

      const already = existingChannels.find(
        (c) => c.type === channelType && c.name === ch.name && c.parentId === category.id
      );
      if (already) {
        await already.permissionOverwrites.set(overwrites);
        console.log(`  Canal já existe, overwrites atualizados: ${ch.voice ? "🔊" : "#"}${ch.name}`);
        continue;
      }
      await guild.channels.create({
        name: ch.name,
        type: channelType,
        parent: category.id,
        permissionOverwrites: overwrites,
      });
      console.log(`  Canal criado: ${ch.voice ? "🔊" : "#"}${ch.name}`);
    }
  }

  console.log("Estrutura aplicada.");
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
