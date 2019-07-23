import React, { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import get from 'lodash/get';
import MenuItem from '@material-ui/core/MenuItem';
import { withStyles, createStyles } from '@material-ui/core/styles';
import compose from 'recompose/compose';
import { addField, translate, FieldTitle, useTranslate } from 'ra-core';

import ResettableTextField from './ResettableTextField';
import InputHelperText from './InputHelperText';

const sanitizeRestProps = ({
    addLabel,
    allowEmpty,
    emptyValue,
    basePath,
    choices,
    className,
    component,
    crudGetMatching,
    crudGetOne,
    defaultValue,
    filter,
    filterToQuery,
    formClassName,
    initializeForm,
    input,
    isRequired,
    label,
    locale,
    meta,
    onChange,
    options,
    optionValue,
    optionText,
    disableValue,
    perPage,
    record,
    reference,
    resource,
    setFilter,
    setPagination,
    setSort,
    sort,
    source,
    textAlign,
    translate,
    translateChoice,
    validation,
    ...rest
}) => rest;

const styles = theme =>
    createStyles({
        input: {
            minWidth: theme.spacing(20),
        },
    });

/**
 * An Input component for a select box, using an array of objects for the options
 *
 * Pass possible options as an array of objects in the 'choices' attribute.
 *
 * By default, the options are built from:
 *  - the 'id' property as the option value,
 *  - the 'name' property an the option text
 * @example
 * const choices = [
 *    { id: 'M', name: 'Male' },
 *    { id: 'F', name: 'Female' },
 * ];
 * <SelectInput source="gender" choices={choices} />
 *
 * You can also customize the properties to use for the option name and value,
 * thanks to the 'optionText' and 'optionValue' attributes.
 * @example
 * const choices = [
 *    { _id: 123, full_name: 'Leo Tolstoi', sex: 'M' },
 *    { _id: 456, full_name: 'Jane Austen', sex: 'F' },
 * ];
 * <SelectInput source="author_id" choices={choices} optionText="full_name" optionValue="_id" />
 *
 * `optionText` also accepts a function, so you can shape the option text at will:
 * @example
 * const choices = [
 *    { id: 123, first_name: 'Leo', last_name: 'Tolstoi' },
 *    { id: 456, first_name: 'Jane', last_name: 'Austen' },
 * ];
 * const optionRenderer = choice => `${choice.first_name} ${choice.last_name}`;
 * <SelectInput source="author_id" choices={choices} optionText={optionRenderer} />
 *
 * `optionText` also accepts a React Element, that will be cloned and receive
 * the related choice as the `record` prop. You can use Field components there.
 * @example
 * const choices = [
 *    { id: 123, first_name: 'Leo', last_name: 'Tolstoi' },
 *    { id: 456, first_name: 'Jane', last_name: 'Austen' },
 * ];
 * const FullNameField = ({ record }) => <span>{record.first_name} {record.last_name}</span>;
 * <SelectInput source="gender" choices={choices} optionText={<FullNameField />}/>
 *
 * The choices are translated by default, so you can use translation identifiers as choices:
 * @example
 * const choices = [
 *    { id: 'M', name: 'myroot.gender.male' },
 *    { id: 'F', name: 'myroot.gender.female' },
 * ];
 *
 * However, in some cases (e.g. inside a `<ReferenceInput>`), you may not want
 * the choice to be translated. In that case, set the `translateChoice` prop to false.
 * @example
 * <SelectInput source="gender" choices={choices} translateChoice={false}/>
 *
 * The object passed as `options` props is passed to the material-ui <Select> component
 *
 * You can disable some choices by providing a `disableValue` field which name is `disabled` by default
 * @example
 * const choices = [
 *    { id: 123, first_name: 'Leo', last_name: 'Tolstoi' },
 *    { id: 456, first_name: 'Jane', last_name: 'Austen' },
 *    { id: 976, first_name: 'William', last_name: 'Rinkerd', disabled: true },
 * ];
 *
 * @example
 * const choices = [
 *    { id: 123, first_name: 'Leo', last_name: 'Tolstoi' },
 *    { id: 456, first_name: 'Jane', last_name: 'Austen' },
 *    { id: 976, first_name: 'William', last_name: 'Rinkerd', not_available: true },
 * ];
 * <SelectInput source="gender" choices={choices} disableValue="not_available" />
 *
 */
export const SelectInput = ({
    allowEmpty,
    choices,
    classes,
    className,
    disableValue,
    emptyText,
    emptyValue,
    helperText,
    input,
    isRequired,
    label,
    meta,
    options,
    optionText,
    optionValue,
    resource,
    source,
    translateChoice,
    ...rest
}) => {
    /*
     * Using state to bypass a redux-form comparison but which prevents re-rendering
     * @see https://github.com/erikras/redux-form/issues/2456
     */
    const [value, setValue] = useState(input.value);
    const translate = useTranslate();

    useEffect(() => {
        setValue(input.value);
    }, [input]);

    const handleChange = useCallback(
        eventOrValue => {
            const value = eventOrValue.target
                ? eventOrValue.target.value
                : eventOrValue;
            input.onChange(value);

            // HACK: For some reason, redux-form does not consider this input touched without calling onBlur manually
            input.onBlur(value);
            setValue(value);
        },
        [input, setValue]
    );

    const renderEmptyItemOption = useCallback(
        emptyText => {
            return React.isValidElement(emptyText)
                ? React.cloneElement(emptyText)
                : translate(emptyText, { _: emptyText });
        },
        [emptyText, translate]
    );

    const renderMenuItemOption = useCallback(
        choice => {
            if (React.isValidElement(optionText)) {
                return React.cloneElement(optionText, {
                    record: choice,
                });
            }

            const choiceName =
                typeof optionText === 'function'
                    ? optionText(choice)
                    : get(choice, optionText);

            return translateChoice
                ? translate(choiceName, { _: choiceName })
                : choiceName;
        },
        [optionText, translate, translateChoice]
    );

    if (typeof meta === 'undefined') {
        throw new Error(
            "The SelectInput component wasn't called within a redux-form <Field>. Did you decorate it and forget to add the addField prop to your component? See https://marmelab.com/react-admin/Inputs.html#writing-your-own-input-component for details."
        );
    }
    const { touched, error } = meta;

    return (
        <ResettableTextField
            select
            margin="normal"
            value={value}
            label={
                <FieldTitle
                    label={label}
                    source={source}
                    resource={resource}
                    isRequired={isRequired}
                />
            }
            name={input.name}
            className={`${classes.input} ${className}`}
            clearAlwaysVisible
            error={!!(touched && error)}
            helperText={
                <InputHelperText
                    touched={touched}
                    error={error}
                    helperText={helperText}
                />
            }
            {...options}
            {...sanitizeRestProps(rest)}
            onChange={handleChange}
        >
            {allowEmpty ? (
                <MenuItem value={emptyValue} key="null">
                    {renderEmptyItemOption(emptyText)}
                </MenuItem>
            ) : null}
            {choices.map(choice => (
                <MenuItem
                    key={get(choice, optionValue)}
                    value={get(choice, optionValue)}
                    disabled={get(choice, disableValue)}
                >
                    {renderMenuItemOption(choice)}
                </MenuItem>
            ))}
        </ResettableTextField>
    );
};

SelectInput.propTypes = {
    allowEmpty: PropTypes.bool.isRequired,
    emptyText: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
    emptyValue: PropTypes.any,
    choices: PropTypes.arrayOf(PropTypes.object),
    classes: PropTypes.object,
    className: PropTypes.string,
    input: PropTypes.object,
    isRequired: PropTypes.bool,
    label: PropTypes.string,
    meta: PropTypes.object,
    options: PropTypes.object,
    optionText: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.func,
        PropTypes.element,
    ]).isRequired,
    optionValue: PropTypes.string.isRequired,
    disableValue: PropTypes.string,
    resource: PropTypes.string,
    source: PropTypes.string,
    translate: PropTypes.func.isRequired,
    translateChoice: PropTypes.bool,
};

SelectInput.defaultProps = {
    allowEmpty: false,
    emptyText: '',
    emptyValue: '',
    classes: {},
    choices: [],
    options: {},
    optionText: 'name',
    optionValue: 'id',
    translateChoice: true,
    disableValue: 'disabled',
};

export default compose(
    addField,
    translate,
    withStyles(styles)
)(SelectInput);
