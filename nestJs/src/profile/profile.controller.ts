import {
  Body,
  Controller,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProfileService } from './profile.service';
import { UserGuard } from '../common/guards/user.guard';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Patch()
  @UseGuards(UserGuard)
  async updateProfile(
    @CurrentUserId() userId: string,
    @Body() updateData: any,
  ) {
    return this.profileService.updateProfile(userId, updateData);
  }

  @Post('avatar')
  @UseGuards(UserGuard)
  @UseInterceptors(FileInterceptor('file'))
  async updateAvatar(
    @CurrentUserId() userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.profileService.updateAvatar(userId, file);
  }
}
