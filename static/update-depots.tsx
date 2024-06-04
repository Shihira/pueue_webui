import React, { useEffect, useRef, useState } from 'react';
import {
    Button,
    Card,
    CardBody,
    CardTitle,
    Checkbox,
    Form,
    FormGroup,
    FormSelect,
    FormSelectOption,
    TextInput,
} from '@patternfly/react-core';

import { pueueManager } from './pueue-manager';

import "@patternfly/patternfly/patternfly";
import "@patternfly/patternfly/patternfly-theme-dark";
import "./styles"

export const UpdateDepots = () => {
    const [ conf, setConf ] = useState<any>({projects: [], active_config: {}});

    const updateForm = async (pipelineName : string = "") => {
        const get_config = await pueueManager.run_local_command_async(
            ['python', 'C:/Users/clairfeng/dotfiles/mac/scripts/update_depots.py', 'entry', '--pipeline-name', pipelineName, 'get_config']);
        const conf = JSON.parse(get_config.stdout);

        setConf(conf);
    };

    const go = async () => {
        const cmdArgs = ['python', 'C:/Users/clairfeng/dotfiles/mac/scripts/update_depots.py', 'dispatch'];
        for (const field in conf.active_config) {
            cmdArgs.push(`--${field.replace('_', '-')}`);
            const v = conf.active_config[field];
            cmdArgs.push(typeof(v) == 'boolean' ? (v?'1':'0') : String(v));
        }
        pueueManager.run_local_command_async(cmdArgs);
    };

    React.useEffect(() => {
        updateForm();
    }, []);

    const confBinding = (from : string, to : string = 'value', onChange : ((v:any)=>any) | null = null) => {
        const dataConverter = {
            value: [ (x:any)=>x, (x:any)=>x ],
            isChecked: [ Boolean, (x:boolean)=>(x?1:0) ],
        };

        const result : any = {};
        result[to] = dataConverter[to][0](conf.active_config[from]);
        result.id = from;
        result.onChange = (_e : Event, v : any) => {
            const newConf = structuredClone(conf);
            newConf.active_config[from] = dataConverter[to][1](v);
            onChange && onChange(v);
            setConf(newConf);
        };
        return result;
    };

    return (
    <Card>
        <CardTitle>Update Depots</CardTitle>
        <CardBody>
            <Form isHorizontal>
                <FormGroup label={'Project'}>
                    <FormSelect {...confBinding('pipeline_name', 'value', updateForm)}>
                        {conf.projects.map((p : string) => <FormSelectOption value={p} key={p} label={p}></FormSelectOption>)}
                    </FormSelect>
                </FormGroup>
                <FormGroup label={'Specified CL'}>
                    <TextInput {...confBinding('specified_cl')}/>
                </FormGroup>
                <FormGroup label={'Options'}>
                    <Checkbox label={'Run Editor'} {...confBinding('run_editor', 'isChecked')}/>
                    <Checkbox label={'Run Client'} {...confBinding('run_client', 'isChecked')}/>
                    <Checkbox label={'Shipping'} {...confBinding('shipping', 'isChecked')}/>
                    <Checkbox label={'Sync Code'} {...confBinding('sync', 'isChecked')}/>
                    <Checkbox label={'Sync Assets'} {...confBinding('sync_content', 'isChecked')}/>
                    <Checkbox label={'Install to Device'} {...confBinding('install', 'isChecked')}/>
                </FormGroup>
            </Form>
            <Button onClick={go}>Go!</Button>
        </CardBody>
    </Card>
    );
};
