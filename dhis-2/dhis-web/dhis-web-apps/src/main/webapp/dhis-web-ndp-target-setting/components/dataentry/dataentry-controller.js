/* global angular, dhis2, ndpTarget */

'use strict';

//Controller for settings page
ndpTarget.controller('DataEntryController',
        function($scope,
                $modal,
                orderByFilter,
                MetaDataFactory,
                DataSetFactory,
                PeriodService,
                CommonUtils,
                DataValueService,
                OptionComboService,
                EventService,
                CompletenessService,
                ModalService,
                DialogService) {

    $scope.saveStatus = {};
    $scope.model = {
        metaDataCached: false,
        dataValuesCopy: {},
        dataValues: {},
        dataElements: [],
        dataElementsById: [],
        dataElementGroups: [],
        dataElementGroupSets: [],
        selectedDataElementGroups: [],
        selectedDataElementGroupSets: [],
        baseLineTargetActualDimensions: [],
        selectedAttributeCategoryCombo: null,
        selectedAttributeOptionCombos: null,
        baseline: null,
        target: null,
        actual: null,
        dataSetsById: {},
        categoryCombosById: {},
        optionSets: [],
        optionSetsById: null,
        dictionaryItems: [],
        attributes: [],
        selectedPeriod: null,
        periods: [],
        periodOffset: 0,
        periodType: 'FinancialJuly',
        actualPeriods: []
    };

    $scope.$watch('selectedOrgUnit', function() {
        $scope.resetDataView();
        if( angular.isObject($scope.selectedOrgUnit)){
            if(!$scope.model.optionSetsById){
                $scope.model.optionSetsById = {};
                MetaDataFactory.getAll('optionSets').then(function(opts){
                    angular.forEach(opts, function(op){
                        $scope.model.optionSetsById[op.id] = op;
                    });

                    MetaDataFactory.getAll('categoryCombos').then(function(ccs){
                        angular.forEach(ccs, function(cc){
                            $scope.model.categoryCombosById[cc.id] = cc;
                        });
                        $scope.loadDataSets($scope.selectedOrgUnit);
                    });
                });
            }
            else{
                $scope.loadDataSets($scope.selectedOrgUnit);
            }
        }
    });

    $scope.resetDataView = function(){
        $scope.model.dataSets = [];
        $scope.model.periods = [];
        $scope.model.selectedAttributeCategoryCombo = null;
        $scope.model.selectedAttributeOptionCombos = null;
        $scope.model.selectedPeriod = null;
        $scope.model.periodOffset = 0;
        $scope.dataValues = {};
        $scope.dataValuesCopy = {};
        $scope.saveStatus = {};
        $scope.model.dataSetCompleteness = false;
    };

    //load datasets associated with the selected org unit.
    $scope.loadDataSets = function() {
        $scope.resetDataView();
        if (angular.isObject($scope.selectedOrgUnit)) {
            DataSetFactory.getByOu( $scope.selectedOrgUnit, $scope.model.selectedDataSet, 'dataSetType', 'quarterlyTargets').then(function(response){
                $scope.model.dataSets = response.dataSets || [];
                $scope.model.selectedDataSet = response.selectedDataSet;
            });
        }
    };

    //watch for selection of data set
    $scope.$watch('model.selectedDataSet', function() {
        $scope.model.periods = [];
        $scope.model.selectedPeriod = null;
        $scope.model.categoryOptionsReady = false;
        $scope.dataValues = {};
        $scope.dataValuesCopy = {};
        $scope.model.dataSetCompleteness = false;
        if( angular.isObject($scope.model.selectedDataSet) && $scope.model.selectedDataSet.id){
            $scope.loadDataSetDetails();
        }
    });

    $scope.$watch('model.selectedPeriod', function(){
        $scope.dataValues = {};
        $scope.dataValuesCopy = {};
        $scope.saveStatus = {};
        $scope.model.dataSetCompleteness = false;
        var getActualPeriods = function(){
            $scope.model.actualPeriods = [];
            if ( $scope.model.selectedPeriod && $scope.model.selectedPeriod.id ){
                $scope.model.actualPeriods = PeriodService.getQuartersForYear( $scope.model.selectedPeriod, $scope.model.selectedDataSet.periodType );
            }
        };

        getActualPeriods();
        $scope.loadDataEntryForm();
    });


    $scope.loadDataSetDetails = function(){
        if( $scope.model.selectedDataSet && $scope.model.selectedDataSet.id && $scope.model.selectedDataSet.periodType){

            if ( $scope.model.selectedDataSet.periodType !== 'Quarterly' ){
                CommonUtils.notify('error', 'system_accepts_quarterly_dataset');
                return;
            }

            $scope.model.periods = PeriodService.getPeriods( $scope.model.periodType, $scope.model.periodOffset,  $scope.model.selectedDataSet.openFuturePeriods );

            if(!$scope.model.selectedDataSet.dataElements || $scope.model.selectedDataSet.dataElements.length < 1){
                CommonUtils.notify('error', 'missing_data_elements_indicators');
                return;
            }

            $scope.model.selectedAttributeCategoryCombo = null;
            if( $scope.model.selectedDataSet && $scope.model.selectedDataSet.categoryCombo && $scope.model.selectedDataSet.categoryCombo.id ){
                $scope.model.selectedAttributeCategoryCombo = $scope.model.categoryCombosById[$scope.model.selectedDataSet.categoryCombo.id];
            }

            if(!$scope.model.selectedAttributeCategoryCombo || $scope.model.selectedAttributeCategoryCombo.categoryOptionCombos.legth < 1 ){
                CommonUtils.notify('error', 'missing_dataset_category_combo');
                return;
            }

            if (!OptionComboService.hasTargetDimension($scope.model.selectedAttributeCategoryCombo) ){
                CommonUtils.notify('error', 'system_only_for_target_setting');
                return;
            }

            angular.forEach($scope.model.selectedAttributeCategoryCombo.categoryOptionCombos, function(aoc){
                if ( aoc.dimensionType === 'baseline' ){
                    $scope.model.baseline = aoc;
                }
                else if ( aoc.dimensionType === 'target' ){
                    $scope.model.target = aoc;
                }
                else if ( aoc.dimensionType === 'actual' ){
                    $scope.model.actual = aoc;
                }
            });

            $scope.model.selectedDataSet.dataElements = orderByFilter( $scope.model.selectedDataSet.dataElements, '-displayName').reverse();
            $scope.model.dataElements = [];
            $scope.tabOrder = {};
            var idx = 0;
            angular.forEach($scope.model.selectedDataSet.dataElements, function(de){
                $scope.model.dataElements[de.id] = de;
                $scope.tabOrder[de.id] = {};
                angular.forEach($scope.model.categoryCombosById[de.categoryCombo.id].categoryOptionCombos, function(oco){
                    $scope.tabOrder[de.id][oco.id] = {};
                    angular.forEach($scope.model.selectedAttributeCategoryCombo.categoryOptionCombos, function(aoc){
                        $scope.tabOrder[de.id][oco.id][aoc.id] = idx++;
                    });
                });
            });
        }
    };

    var copyDataValues = function(){
        $scope.dataValuesCopy = angular.copy( $scope.dataValues );
    };

    $scope.loadDataEntryForm = function(){
        $scope.saveStatus = {};

        if( $scope.selectedOrgUnit && $scope.selectedOrgUnit.id &&
                $scope.model.selectedDataSet && $scope.model.selectedDataSet.id &&
                $scope.model.actualPeriods && $scope.model.actualPeriods.length > 0 ){

            var dataValueSetUrl = 'dataSet=' + $scope.model.selectedDataSet.id;

            dataValueSetUrl += '&period=' + $.map($scope.model.actualPeriods, function(pe){return pe.id;}).join(',');

            dataValueSetUrl += '&orgUnit=' + $scope.selectedOrgUnit.id;

            DataValueService.getDataValueSet( dataValueSetUrl ).then(function( response ){
                if( response.dataValues && response.dataValues.length > 0 ){
                    $scope.model.valueExists = true;

                    angular.forEach(response.dataValues, function(dv){
                        dv.period = $scope.model.selectedPeriod.id;
                        dv.value = CommonUtils.formatDataValue( $scope.model.dataElements[dv.dataElement], dv.value, $scope.model.optionSetsById, 'USER' );
                        var de = $scope.model.dataElements[dv.dataElement];

                        if ( de ){
                            if(!$scope.dataValues[dv.dataElement]){
                                $scope.dataValues[dv.dataElement] = {};
                                $scope.dataValues[dv.dataElement][dv.categoryOptionCombo] = {};
                                $scope.dataValues[dv.dataElement][dv.categoryOptionCombo][dv.attributeOptionCombo] = {quarterValues: []};
                            }
                            if(!$scope.dataValues[dv.dataElement][dv.categoryOptionCombo]){
                                $scope.dataValues[dv.dataElement][dv.categoryOptionCombo] = {};
                                $scope.dataValues[dv.dataElement][dv.categoryOptionCombo][dv.attributeOptionCombo] = {quarterValues: []};
                            }
                            if(!$scope.dataValues[dv.dataElement][dv.categoryOptionCombo][dv.attributeOptionCombo]){
                                $scope.dataValues[dv.dataElement][dv.categoryOptionCombo][dv.attributeOptionCombo] = {quarterValues: []};
                            }

                            $scope.dataValues[dv.dataElement][dv.categoryOptionCombo][dv.attributeOptionCombo] = Object.assign($scope.dataValues[dv.dataElement][dv.categoryOptionCombo][dv.attributeOptionCombo], dv);
                            $scope.dataValues[dv.dataElement][dv.categoryOptionCombo][dv.attributeOptionCombo].quarterValues.push( dv.value );
                            $scope.dataValues[dv.dataElement][dv.categoryOptionCombo][dv.attributeOptionCombo].aggregateValue = CommonUtils.getAgregateValue( de, $scope.dataValues[dv.dataElement][dv.categoryOptionCombo][dv.attributeOptionCombo].quarterValues);

                            if( dv.comment ){
                                $scope.dataValues[dv.dataElement][dv.categoryOptionCombo][dv.attributeOptionCombo].hasComment = true;
                            }
                        }
                    });
                    copyDataValues();
                }

            });

            CompletenessService.get( $scope.model.selectedDataSet.id,
                                $scope.selectedOrgUnit.id,
                                $scope.model.selectedPeriod.startDate,
                                $scope.model.selectedPeriod.endDate,
                                false).then(function(response){
                if( response &&
                        response.completeDataSetRegistrations &&
                        response.completeDataSetRegistrations.length &&
                        response.completeDataSetRegistrations.length > 0){

                    $scope.model.dataSetCompleteness = true;
                }
            });
        }
    };

    $scope.interacted = function(field) {
        var status = false;
        if(field){
            status = $scope.outerForm.submitted || field.$dirty;
        }
        return status;
    };

    function checkOptions(){
        resetParams();
        for(var i=0; i<$scope.model.selectedAttributeCategoryCombo.categories.length; i++){
            if($scope.model.selectedAttributeCategoryCombo.categories[i].selectedOption && $scope.model.selectedAttributeCategoryCombo.categories[i].selectedOption.id){
                $scope.model.categoryOptionsReady = true;
                $scope.model.selectedOptions.push($scope.model.selectedAttributeCategoryCombo.categories[i].selectedOption);
            }
            else{
                $scope.model.categoryOptionsReady = false;
                break;
            }
        }
        if($scope.model.categoryOptionsReady){
            $scope.loadDataEntryForm();
        }
    };

    $scope.getCategoryOptions = function(){
        $scope.model.categoryOptionsReady = false;
        $scope.model.selectedOptions = [];
        checkOptions();
    };

    $scope.getPeriods = function(mode){
        $scope.model.selectedPeriod = null;

        $scope.model.periodOffset = mode === 'NXT' ? ++$scope.model.periodOffset : --$scope.model.periodOffset;

        $scope.model.periods = PeriodService.getPeriods( $scope.model.periodType, $scope.model.periodOffset,  $scope.model.selectedDataSet.openFuturePeriods );
    };

    $scope.saveDataValue = function( deId, ocId, aoc ){

        //check for form validity
        if( $scope.outerForm.$invalid ){
            $scope.outerForm.$error = {};
            $scope.outerForm.$setPristine();
            return ;
        }

        //form is valid
        $scope.saveStatus[ deId + '-' + ocId + '-' + aoc.id ] = {saved: false, pending: true, error: false};
        var de = $scope.model.dataElements[deId];
        var value = CommonUtils.formatDataValue( de, $scope.dataValues[deId][ocId][aoc.id].aggregateValue, $scope.model.optionSetsById, 'API' );
        var comment = $scope.dataValues[deId][ocId][aoc.id].comment;
        var eventsToClear = [];
        if( !value || value === "" ){
            value = "";
            comment = JSON.parse( comment );
            if ( comment && comment.attachment ){
                eventsToClear = comment.attachment;
            }
        }
        else {
            value = de && de.aggregationType === 'SUM' ? value / 4 : value;
        }
        var dataValueSet = {
            dataValues: []
        };
        angular.forEach($scope.model.actualPeriods, function(p){
            dataValueSet.dataValues.push( {
                orgUnit: $scope.selectedOrgUnit.id,
                dataElement: deId,
                categoryOptionCombo: ocId,
                attributeOptionCombo: aoc.id,
                value: value,
                deleted: value === "" || !value,
                period: p.id,
                comment: comment
            });
        });

        var processDataValue = function(){
            copyDataValues();
        };

        var saveSuccessStatus = function(){
            $scope.saveStatus[deId + '-' + ocId + '-' + aoc.id].saved = true;
            $scope.saveStatus[deId + '-' + ocId + '-' + aoc.id].pending = false;
            $scope.saveStatus[deId + '-' + ocId + '-' + aoc.id].error = false;
        };

        var saveFailureStatus = function(){
            $scope.saveStatus[deId + '-' + ocId + '-' + aoc.id].saved = false;
            $scope.saveStatus[deId + '-' + ocId + '-' + aoc.id].pending = false;
            $scope.saveStatus[deId + '-' + ocId + '-' + aoc.id].error = true;
        };

        DataValueService.saveDataValueSet( dataValueSet ).then(function(){
            saveSuccessStatus();
            processDataValue();
            if ( eventsToClear.length > 0 ){
                angular.forEach(eventsToClear, function(ev){
                    EventService.deleteEvent(ev).then(function(data){
                        delete $scope.dataValues[deId][ocId][aoc.id].comment;
                        $scope.dataValues[deId][ocId][aoc.id].hasComment = false;
                    });
                });
           }
        }, function(){
            saveFailureStatus();
        });
    };

    $scope.getInputNotifcationClass = function(deId, ocId, aocId){

        var currentElement = $scope.saveStatus[deId + '-' + ocId + '-' + aocId];
        if( currentElement ){
            if(currentElement.pending){
                return 'form-control input-pending';
            }

            if(currentElement.saved){
                return 'form-control input-success';
            }
            else{
                return 'form-control input-error';
            }
        }

        return 'form-control';
    };

    $scope.getCommentValue = function( dataElementId, optionComboId ){
        var comments = [], hasAttachement = false, hasExplanation = false;
        if( $scope.dataValues[dataElementId] && $scope.dataValues[dataElementId][optionComboId] ){
            var values = $scope.dataValues[dataElementId][optionComboId];
            for( var key in values ){
                if( values[key].comment ){
                    var comment = JSON.parse( angular.copy( values[key].comment) );
                    if(comment.attachment){
                        hasAttachement = true;
                    }
                    if(comment.explanation){
                        hasExplanation = true;
                    }
                }
            }
        }
        if(hasAttachement){
            comments.push('has_attachment');
        }
        if(hasExplanation){
            comments.push('has_explanation');
        }
        return comments.join('_');
    };

    $scope.displayCommentBox = function( dataElementId, optionCombo ){
        var dataElement = $scope.model.dataElements[dataElementId];
        var modalInstance = $modal.open({
            templateUrl: 'components/comment/comment.html',
            controller: 'CommentController',
            windowClass: 'comment-modal-window',
            resolve: {
                dataElement: function(){
                    return dataElement;
                },
                selectedOrgUnit: function(){
                    return $scope.selectedOrgUnit;
                },
                selectedPeriod: function(){
                    return $scope.model.selectedPeriod;
                },
                actualPeriods: function(){
                    return $scope.model.actualPeriods;
                },
                dataValues: function(){
                    return $scope.dataValues;
                },
                selectedCategoryOptionCombo: function(){
                    return optionCombo;
                },
                selectedCategoryCombo: function(){
                    return $scope.model.categoryCombosById[dataElement.categoryCombo.id];
                },
                selectedAttributeCategoryCombo: function(){
                    return $scope.model.selectedAttributeCategoryCombo;
                },
                optionSetsById: function(){
                    return $scope.model.optionSetsById;
                }
            }
        });

        modalInstance.result.then(function( dataValues ) {
            $scope.dataValues = dataValues;
        });
    };

    $scope.isAllowedDimension = function( aoc ){
        var allowed = ['target', 'baseline', 'planned'];
        return allowed.indexOf(aoc.dimensionType) !== -1;
    };
    
    $scope.isDisabled = function( aoc ){
        return !aoc.dWrite || $scope.model.dataSetCompleteness;
    };

    $scope.canSubmitData = function(){
        return CommonUtils.userHasAuthority('F_COMPLETE_DATASET');
    };

    $scope.canUnSubmitData = function(){
        return CommonUtils.userHasAuthority('F_UNCOMPLETE_DATASET');
    };

    $scope.saveCompletness = function(){
        var modalOptions = {
            closeButtonText: 'no',
            actionButtonText: 'yes',
            headerText: 'submit_data',
            bodyText: 'are_you_sure_to_submit_data'
        };

        ModalService.showModal({}, modalOptions).then(function(result){
            var dsr = {completeDataSetRegistrations: []};
            angular.forEach($scope.model.selectedAttributeCategoryCombo.categoryOptionCombos, function(aoc){
                if ( aoc.dimensionType === 'baseline'  || aoc.dimensionType === 'target' ){
                    angular.forEach($scope.model.actualPeriods, function(p){
                        dsr.completeDataSetRegistrations.push( {dataSet: $scope.model.selectedDataSet.id, organisationUnit: $scope.selectedOrgUnit.id, period: p.id, attributeOptionCombo: aoc.id} );
                    });
                }
            });

            CompletenessService.saveDsr(dsr).then(function(response){
                var dialogOptions = {
                    headerText: 'success',
                    bodyText: 'data_submitted'
                };
                DialogService.showDialog({}, dialogOptions);
                $scope.model.dataSetCompleteness = true;

            }, function(response){
                CommonUtils.errorNotifier( response );
            });
        });
    };

    $scope.deleteCompletness = function( orgUnit, multiOrgUnit){
        var modalOptions = {
            closeButtonText: 'no',
            actionButtonText: 'yes',
            headerText: 'un_submit_data',
            bodyText: 'are_you_sure_to_recall_data_and_edit'
        };

        ModalService.showModal({}, modalOptions).then(function(result){

            angular.forEach($scope.model.selectedAttributeCategoryCombo.categoryOptionCombos, function(aoc){
                if ( aoc.dimensionType === 'baseline'  || aoc.dimensionType === 'target' ){
                    angular.forEach($scope.model.actualPeriods, function(p){
                        CompletenessService.delete($scope.model.selectedDataSet.id,
                            p.id,
                            $scope.selectedOrgUnit.id,
                            $scope.model.selectedAttributeCategoryCombo.id,
                            CommonUtils.getOptionIds(aoc.categoryOptions),
                            false).then(function(response){

                            var dialogOptions = {
                                headerText: 'success',
                                bodyText: 'data_unsubmitted'
                            };
                            DialogService.showDialog({}, dialogOptions);
                            $scope.model.dataSetCompleteness = false;

                        }, function(response){
                            CommonUtils.errorNotifier( response );
                        });
                    });
                }
            });
        });
    };
});