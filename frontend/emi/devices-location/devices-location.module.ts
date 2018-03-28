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
        RouterModule.forChild(routes),
        // AgmCoreModule.forRoot({
        //   // apiKey: 'AIzaSyD81ecsCj4yYpcXSLFcYU97PvRsE_X8Bx8',
        //   apiKey: 'AIzaSyAWKVOt02pFVoLRe_zv0XJ_VpWnkKA7Txg',
        //   libraries: ['places']
        // })
    ],
    declarations: [
        DevicesLocationComponent
    ]
})
export class DevicesLocationModule
{
}
