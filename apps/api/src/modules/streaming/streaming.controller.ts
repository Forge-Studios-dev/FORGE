import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { StreamingService } from './streaming.service';
import { CreateStreamDto } from './dto/create-stream.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Streaming')
@Controller('streams')
export class StreamingController {
  constructor(private readonly streamingService: StreamingService) {}

  @Post('start')
  @ApiOperation({ summary: 'Create a new live stream' })
  createStream(@CurrentUser() user: JwtPayload, @Body() dto: CreateStreamDto) {
    return this.streamingService.createStream(user.sub, dto);
  }

  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Get currently live streams' })
  getLiveStreams() {
    return this.streamingService.getLiveStreams();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get stream by ID' })
  findOne(@Param('id') id: string) {
    return this.streamingService.findById(id);
  }

  @Post(':id/end')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'End a live stream' })
  endStream(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.streamingService.endStream(user.sub, id);
  }

  @Public()
  @Post('webhooks/mux')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mux webhook handler' })
  handleMuxWebhook(@Body() payload: Record<string, unknown>) {
    return this.streamingService.handleMuxWebhook(payload);
  }
}
