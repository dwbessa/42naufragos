import "dotenv/config";
import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } from "discord.js";

const ALUNO_ROLE_ID = process.env.DISCORD_VERIFIED_ROLE_ID;
const TRANSCENDER_ROLE_ID = process.env.DISCORD_TRANSCENDER_ROLE_ID;
const STAFF_ROLE_ID = "1545496217360928869"; // multiplicador
const BOT_ROLE_ID = "1545495131975720964"; // 42naufragos (managed role do bot)

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function overwritesFor(guild, { staffOnly = false, publicRead = false, botOnlyWrite = false } = {}) {
  const everyone = guild.roles.everyone.id;
  const byId = new Map();

  function merge(id, { allow = [], deny = [] }) {
    const entry = byId.get(id) ?? { id, allow: new Set(), deny: new Set() };
    allow.forEach((bit) => entry.allow.add(bit));
    deny.forEach((bit) => entry.deny.add(bit));
    byId.set(id, entry);
  }

  if (staffOnly) {
    merge(everyone, { deny: [PermissionFlagsBits.ViewChannel] });
    merge(ALUNO_ROLE_ID, { deny: [PermissionFlagsBits.ViewChannel] });
    merge(STAFF_ROLE_ID, { allow: [PermissionFlagsBits.ViewChannel] });
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
    allow: [...e.allow],
    deny: [...e.deny],
  }));
}

const structure = [
  {
    name: "INÍCIO",
    channels: [
      { name: "regras", publicRead: true, botOnlyWrite: true },
      { name: "anúncios", botOnlyWrite: true },
      { name: "verificação", publicRead: true, botOnlyWrite: true },
    ],
  },
  {
    name: "GERAL",
    channels: [{ name: "geral" }, { name: "off-topic" }, { name: "memes" }],
  },
  {
    name: "PISCINE",
    channels: [{ name: "piscine-geral" }, { name: "piscine-ajuda" }],
  },
  {
    name: "CURSUS",
    channels: [{ name: "geral-cursus" }],
  },
  {
    name: "PROJETOS",
    channels: [{ name: "buscando-dupla" }, { name: "showcase" }],
  },
  {
    name: "STAFF",
    staffOnly: true,
    channels: [{ name: "staff-geral", staffOnly: true }, { name: "logs", staffOnly: true }],
  },
];

client.once("ready", async () => {
  const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
  const existingChannels = await guild.channels.fetch();

  for (const cat of structure) {
    let category = existingChannels.find(
      (c) => c.type === ChannelType.GuildCategory && c.name === cat.name
    );

    const categoryOverwrites = overwritesFor(guild, { staffOnly: cat.staffOnly });

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
      const already = existingChannels.find(
        (c) => c.type === ChannelType.GuildText && c.name === ch.name && c.parentId === category.id
      );
      if (already) {
        await already.permissionOverwrites.set(
          overwritesFor(guild, { staffOnly: ch.staffOnly, publicRead: ch.publicRead, botOnlyWrite: ch.botOnlyWrite })
        );
        console.log(`  Canal já existe, overwrites atualizados: #${ch.name}`);
        continue;
      }
      await guild.channels.create({
        name: ch.name,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: overwritesFor(guild, {
          staffOnly: ch.staffOnly,
          publicRead: ch.publicRead,
          botOnlyWrite: ch.botOnlyWrite,
        }),
      });
      console.log(`  Canal criado: #${ch.name}`);
    }
  }

  console.log("Estrutura aplicada.");
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
