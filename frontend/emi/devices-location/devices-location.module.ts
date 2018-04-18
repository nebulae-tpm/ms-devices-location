import { DevicesLocationService } from './devices-location.service';
import { NgModule } from '@angular/core';
import { SharedModule } from '../../../core/modules/shared.module';
import { RouterModule } from '@angular/router';
import { DevicesLocationComponent } from './devices-location.component';

const routes = [
    {
        path     : '',
        component: DevicesLocationComponent
    }
];

@NgModule({
    imports     : [
        SharedModule,
        RouterModule.forChild(routes)
    ],
    declarations: [
        DevicesLocationComponent
    ],
    providers: [DevicesLocationService]
})
export class DevicesLocationModule
{
}
