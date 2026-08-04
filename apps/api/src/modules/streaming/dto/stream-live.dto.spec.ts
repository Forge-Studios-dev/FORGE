import { validateSync } from 'class-validator';
import {
  AddCoHostDto,
  AssignBreakoutRoomsDto,
  CreateAudienceRequestDto,
  CreateBreakoutRoomsDto,
  EndBreakoutRoomsDto,
  RespondAudienceRequestDto,
  SetVipTierDto,
} from './stream-live.dto';

describe('stream live control DTOs', () => {
  it('rejects invalid audience request type', () => {
    const dto = Object.assign(new CreateAudienceRequestDto(), {
      requestType: 'bad-type',
      message: 'hello',
    });

    expect(validateSync(dto).length).toBeGreaterThan(0);
  });

  it('rejects breakout assignment with malformed room ids', () => {
    const dto = Object.assign(new AssignBreakoutRoomsDto(), {
      communityId: '00000000-0000-4000-8000-0000000000a1',
      roomIds: ['not-a-uuid'],
    });

    expect(validateSync(dto).length).toBeGreaterThan(0);
  });

  it('rejects breakout end with an empty room list', () => {
    const dto = Object.assign(new EndBreakoutRoomsDto(), { roomIds: [] });

    expect(validateSync(dto).length).toBeGreaterThan(0);
  });

  it('rejects co-host payloads with malformed user ids', () => {
    const dto = Object.assign(new AddCoHostDto(), { userId: 'nope' });

    expect(validateSync(dto).length).toBeGreaterThan(0);
  });

  it('allows null vip tier to clear VIP config', () => {
    const dto = Object.assign(new SetVipTierDto(), { vipTierId: null });

    expect(validateSync(dto)).toHaveLength(0);
  });

  it('rejects invalid breakout room sizing', () => {
    const dto = Object.assign(new CreateBreakoutRoomsDto(), {
      roomCount: 1,
      durationMinutes: 0,
      maxParticipantsPerRoom: 1,
    });

    expect(validateSync(dto).length).toBeGreaterThan(0);
  });

  it('requires an explicit approval boolean', () => {
    const dto = new RespondAudienceRequestDto();

    expect(validateSync(dto).length).toBeGreaterThan(0);
  });
});
