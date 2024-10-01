import { Injectable } from '@nestjs/common';
import { Ctx, On, Start, Update, Action } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { Message } from 'typegram';
import { VoiceService } from '../voice/voice.service';
import { InlineQueryResult } from 'telegraf/typings/core/types/typegram';
import { ConfigService } from '@nestjs/config';
import { AdminService } from '../admin/admin.service';
import { CallbackQuery } from 'telegraf/typings/core/types/typegram';

interface BotContext extends Context {
  session: {
    waitingForVoice?: boolean;
    waitingForCaption?: boolean;
    lastMessageId?: number;
    lastVoiceFileId?: string;
    waitingForAdmin?: boolean;
  };
  callbackQuery: CallbackQuery.DataQuery; // Додаємо цей рядок
}

@Injectable()
@Update()
export class BotService {
  private readonly channelId: string;

  constructor(
    private readonly voiceService: VoiceService,
    private readonly adminsService: AdminService,
    private readonly configService: ConfigService,
  ) {
    this.channelId = this.configService.get<string>('CHANNEL_ID');
  }

  private initSession(ctx: BotContext) {
    if (!ctx.session) {
      ctx.session = {
        waitingForVoice: false,
        waitingForCaption: false,
        lastMessageId: undefined,
        lastVoiceFileId: undefined,
        waitingForAdmin: false, // Додано для управління адміністраторами
      };
    }
  }

  @Start()
  async start(@Ctx() ctx: BotContext) {
    this.initSession(ctx);

    const isAdmin = await this.isAdmin(ctx.from.id);

    if (!isAdmin) {
      await ctx.reply('Щоб скористатися ботом використовуйте inline-режим.');
      return;
    }

    await ctx.reply('Вітаю! Я бот для голосових цитат. Виберіть дію:', {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: 'Додати цитату',
              callback_data: 'add_quote',
            },
            {
              text: 'Управління цитатами',
              callback_data: 'manage_quotes',
            },
          ],
          [
            {
              text: 'Керувати адміністраторами',
              callback_data: 'manage_admins',
            },
          ],
        ],
      },
    });
  }

  @Action('manage_quotes')
  async onManageQuotes(@Ctx() ctx: BotContext) {
    const voices = await this.voiceService.getAllVoices();

    if (voices.length === 0) {
      await ctx.reply('Наразі немає збережених цитат.', {
        reply_markup: {
          inline_keyboard: [[{ text: 'Назад', callback_data: 'back_to_menu' }]],
        },
      });
      return;
    }

    const quotesPerPage = 5;
    const pages = Math.ceil(voices.length / quotesPerPage);

    await this.showQuotesPage(ctx, voices, 0, pages);
  }

  private async showQuotesPage(
    ctx: BotContext,
    voices: any[],
    page: number,
    totalPages: number,
  ) {
    const quotesPerPage = 5;
    const start = page * quotesPerPage;
    const end = Math.min(start + quotesPerPage, voices.length);

    const pageVoices = voices.slice(start, end);

    let message = 'Список цитат:\n\n';
    pageVoices.forEach((voice, index) => {
      message += `${start + index + 1}. ${voice.title}\nID: ${voice._id}\n\n`;
    });

    const keyboard = [];

    // Кнопки для кожної цитати на сторінці
    pageVoices.forEach((voice) => {
      keyboard.push([
        {
          text: `Видалити: ${voice.title.substring(0, 20)}${voice.title.length > 20 ? '...' : ''}`,
          callback_data: `delete_quote:${voice._id}`,
        },
      ]);
    });

    // Кнопки навігації
    const navigationRow = [];
    if (page > 0) {
      navigationRow.push({
        text: '⬅️ Попередня',
        callback_data: `page:${page - 1}`,
      });
    }
    if (page < totalPages - 1) {
      navigationRow.push({
        text: 'Наступна ➡️',
        callback_data: `page:${page + 1}`,
      });
    }
    if (navigationRow.length > 0) {
      keyboard.push(navigationRow);
    }

    // Кнопка повернення в меню
    keyboard.push([
      {
        text: 'Повернутися в меню',
        callback_data: 'back_to_menu',
      },
    ]);

    await ctx
      .editMessageText(message, {
        reply_markup: {
          inline_keyboard: keyboard,
        },
      })
      .catch(async () => {
        await ctx.reply(message, {
          reply_markup: {
            inline_keyboard: keyboard,
          },
        });
      });
  }

  @Action(/^page:(\d+)$/)
  async onPageChange(@Ctx() ctx: BotContext) {
    const match = ctx.callbackQuery.data.match(/^page:(\d+)$/);
    if (!match) return;

    const page = parseInt(match[1]);
    const voices = await this.voiceService.getAllVoices();
    const totalPages = Math.ceil(voices.length / 5);

    await this.showQuotesPage(ctx, voices, page, totalPages);
  }

  @Action(/^delete_quote:(.+)$/)
  async onDeleteQuote(@Ctx() ctx: BotContext) {
    const match = ctx.callbackQuery.data.match(/^delete_quote:(.+)$/);
    if (!match) return;

    const quoteId = match[1];

    try {
      await this.voiceService.deleteVoice(quoteId);
      await ctx.answerCbQuery('Цитату успішно видалено!');

      // Оновлюємо список цитат
      const voices = await this.voiceService.getAllVoices();
      if (voices.length === 0) {
        await ctx.editMessageText('Всі цитати видалено.', {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Назад', callback_data: 'back_to_menu' }],
            ],
          },
        });
        return;
      }

      const totalPages = Math.ceil(voices.length / 5);
      await this.showQuotesPage(ctx, voices, 0, totalPages);
    } catch (error) {
      console.error('Error deleting quote:', error);
      await ctx.answerCbQuery('Помилка при видаленні цитати.');
    }
  }

  @Action('manage_admins')
  async onManageAdmins(@Ctx() ctx: BotContext) {
    await ctx.reply('Ви можете додати або видалити адміністратора.', {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: 'Додати адміністратора',
              callback_data: 'add_admin',
            },
            {
              text: 'Повернутися в меню',
              callback_data: 'back_to_menu',
            },
          ],
        ],
      },
    });
  }

  // Обробник для додавання адміністратора
  @Action('add_admin')
  async onAddAdmin(@Ctx() ctx: BotContext) {
    ctx.session.waitingForAdmin = true; // Включаємо режим очікування
    await ctx.reply(
      'Перешліть повідомлення користувача щоб зробити його адімністратором.',
    );
  }

  // Повернення в меню
  @Action('back_to_menu')
  async onBackToMenu(@Ctx() ctx: BotContext) {
    await this.start(ctx);
  }

  @Action('add_quote')
  async onAddQuote(@Ctx() ctx: BotContext) {
    this.initSession(ctx);
    ctx.session.waitingForVoice = true;
    await ctx.reply(
      'Будь ласка, надішліть голосове повідомлення, яке ви хочете додати як цитату.',
    );
  }

  @Action('finish')
  async onFinish(@Ctx() ctx: BotContext) {
    this.initSession(ctx);
    ctx.session = {
      waitingForVoice: false,
      waitingForCaption: false,
      lastMessageId: undefined,
      lastVoiceFileId: undefined,
    };
    await ctx.reply('Щоб почати знову, натисніть /start');
  }

  @On('voice')
  async onVoiceMessage(@Ctx() ctx: BotContext) {
    this.initSession(ctx);
    if (!ctx.session.waitingForVoice) {
      await ctx.reply('Спочатку натисніть кнопку "Додати цитату".');
      return;
    }

    try {
      const voice = (ctx.message as Message.VoiceMessage).voice;

      // Пересилаємо повідомлення в канал
      const sentMessage = await ctx.telegram.sendVoice(
        this.channelId,
        voice.file_id,
      );

      // Зберігаємо ID повідомлення та file_id в сесії
      ctx.session.lastMessageId = sentMessage.message_id;
      ctx.session.lastVoiceFileId = voice.file_id; // Зберігаємо file_id в сесії

      ctx.session.waitingForVoice = false;
      ctx.session.waitingForCaption = true;

      await ctx.reply('Чудово! Тепер додайте підпис до цієї голосової цитати.');
    } catch (error) {
      if (error.response?.error_code === 403) {
        await ctx.reply(
          `Бот не є адміністратором каналу ${this.channelId}. Будь ласка, додайте бота як адміністратора каналу.`,
        );
      } else {
        console.error('Error handling voice message:', error);
        await ctx.reply(
          'Виникла помилка при обробці голосового повідомлення. Спробуйте ще раз.',
        );
      }
    }
  }

  @On('text')
  async onTextMessage(@Ctx() ctx: BotContext) {
    this.initSession(ctx);

    if (ctx.session.waitingForAdmin) {
      try {
        const message = ctx.message as Message.TextMessage;
        const forwardedFrom = message.forward_from;

        // Перевіряємо, чи повідомлення переслане
        if (forwardedFrom) {
          const userId = forwardedFrom.id;

          // Перевіряємо, чи не є ID користувача ID відправника оригінального повідомлення
          if (userId !== ctx.from.id) {
            // Перевіряємо, чи вже є користувач адміністратором
            const isAdmin = await this.adminsService.isAdmin(userId);
            if (isAdmin) {
              await ctx.reply('Цей користувач вже є адміністратором.');
            } else {
              await this.adminsService.addAdmin(userId);
              ctx.session.waitingForAdmin = false;

              await ctx.reply('Адміністратора успішно додано!');
            }
          } else {
            await ctx.reply(
              'Ви не можете додати свій власний акаунт як адміністратора. Будь ласка, пересилайте повідомлення іншого користувача.',
            );
          }
        } else {
          await ctx.reply(
            'Будь ласка, перешліть повідомлення користувача, щоб зробити його адміністратором. Його акаунт не повинен бути прихованим.',
          );
        }
      } catch (error) {
        console.error('Error adding admin:', error);
        await ctx.reply(
          'Виникла помилка при додаванні адміністратора. Спробуйте ще раз.',
        );
      }
      return;
    }

    if (!ctx.session.waitingForCaption || !ctx.session.lastMessageId) {
      return;
    }

    try {
      const caption = (ctx.message as Message.TextMessage).text;

      // Отримуємо fileId з сесії
      const fileId = ctx.session.lastVoiceFileId; // Використовуємо file_id з сесії

      // Редагуємо повідомлення в каналі, додаючи підпис
      await ctx.telegram.editMessageCaption(
        this.channelId,
        ctx.session.lastMessageId,
        undefined,
        caption,
      );

      // Зберігаємо голосове повідомлення в базі даних після отримання підпису
      await this.voiceService.addVoice(fileId, caption);

      // Скидаємо стан сесії
      ctx.session.waitingForCaption = false;
      ctx.session.lastMessageId = undefined;
      ctx.session.lastVoiceFileId = undefined;

      await ctx.reply(
        'Цитату успішно додано до каналу та збережено! Що бажаєте зробити далі?',
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: 'Додати ще цитату',
                  callback_data: 'add_quote',
                },
                {
                  text: 'Завершити роботу',
                  callback_data: 'finish',
                },
              ],
            ],
          },
        },
      );
    } catch (error) {
      console.error('Error handling text message:', error);
      await ctx.reply(
        'Виникла помилка при додаванні підпису. Спробуйте ще раз.',
      );
    }
  }

  @On('inline_query')
  async onInlineQuery(@Ctx() ctx: BotContext) {
    const query = ctx.inlineQuery?.query || '';

    try {
      const voices = await this.voiceService.searchVoices(query);

      const results: InlineQueryResult[] = voices.map((voice, index) => ({
        type: 'voice',
        id: String(index),
        voice_file_id: voice.fileId,
        title: voice.title,
        // caption: voice.title,
      }));

      // Відправляємо результати запиту
      await ctx.answerInlineQuery(results, {
        cache_time: 0,
        is_personal: true,
      });
    } catch (error) {
      console.error('Error handling inline query:', error);
      await ctx.answerInlineQuery([], {
        cache_time: 0,
      });
    }
  }

  private async isAdmin(userId: number): Promise<boolean> {
    return await this.adminsService.isAdmin(userId);
  }
}
