import { MapDialogComponent } from './dialog/map-dialog.component';
import { DatePipe } from '@angular/common';
import { DevicesLocationService } from './devices-location.service';
import { NgModule } from '@angular/core';
import { SharedModule } from '../../../core/modules/shared.module';
import { RouterModule } from '@angular/router';
import { DevicesLocationComponent } from './devices-location.component';
import { DialogDraggableTitleDirective } from './dialog/dialog-draggable-title.directive';

const routes = [
    {
        path     : '',
        component: DevicesLocationComponent
    },
    {
      path     : ':id',
      component: DevicesLocationComponent
  }
];

@NgModule({
    imports     : [
        SharedModule,
        RouterModule.forChild(routes)
    ],
    declarations: [
        DevicesLocationComponent,
        MapDialogComponent,
        DialogDraggableTitleDirective
    ],
    providers: [DevicesLocationService, DatePipe],
    entryComponents: [MapDialogComponent]
})
export class DevicesLocationModule
{
}
