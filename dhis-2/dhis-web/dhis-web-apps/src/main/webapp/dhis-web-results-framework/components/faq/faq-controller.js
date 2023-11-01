/* global angular, dhis2, docLibrary */

'use strict';

//Controller for settings page
ndpFramework.controller('FaqController',
        function($scope,
                $translate,
                $filter,
                NotificationService,
                EventService,
                MetaDataFactory,
                OrgUnitFactory) {

    $scope.model = {
        optionSets: null,
        events: [],
        dataElements: [],
        programmeDataElement: null,
        showFaqResponse: false,
        selectedFaq: null,
        faqs: []
    };

    /*$scope.model.horizontalMenus = [
        {id: 'faq', title: 'faq_title', order: 1, view: 'components/faq/faq.html', active: true, class: 'main-horizontal-menu'}
    ];*/

    MetaDataFactory.getAll('optionSets').then(function(optionSets){
        $scope.model.optionSets = optionSets.reduce( function(map, obj){
            map[obj.id] = obj;
            return map;
        }, {});

        MetaDataFactory.getAll('programs').then(function(programs){
            $scope.model.programs = $filter('filter')(programs, {programType: 'WITHOUT_REGISTRATION', programDomain: 'faq'}, true);

            //Get orgunits for the logged in user
            OrgUnitFactory.getViewTreeRoot().then(function(response) {
                $scope.orgUnits = response.organisationUnits;
                angular.forEach($scope.orgUnits, function(ou){
                    ou.show = true;
                    angular.forEach(ou.children, function(o){
                        o.hasChildren = o.children && o.children.length > 0 ? true : false;
                    });
                });
                $scope.selectedOrgUnit = $scope.orgUnits[0] ? $scope.orgUnits[0] : null;
            });
        });
    });

    //watch for selection of program
    $scope.$watch('model.selectedProgram', function() {
        $scope.model.selectedProgramStage = null;
        $scope.model.faqs = [];
        if( angular.isObject($scope.model.selectedProgram) && $scope.model.selectedProgram.id){
            $scope.loadProgramDetails();
        }
    });

    $scope.loadProgramDetails = function (){
        $scope.model.selectedProgramStage = null;
        $scope.model.faqs = [];
        if( $scope.model.selectedProgram && $scope.model.selectedProgram.id && $scope.model.selectedProgram.programStages.length > 0)
        {
            $scope.model.selectedProgramStage = $scope.model.selectedProgram.programStages[0];

            var prDes = $scope.model.selectedProgramStage.programStageDataElements;

            $scope.model.dynamicHeaders = [{id: 'faq', displayName: $translate.instant('faq_title')}];
            $scope.model.dataElements = [];
            angular.forEach(prDes, function(prDe){
                $scope.model.dataElements[prDe.dataElement.id] = prDe.dataElement;
            });

            $scope.fetchEvents();
        }
    };

    $scope.fetchEvents = function(){

        if( $scope.selectedOrgUnit && $scope.selectedOrgUnit.id && $scope.model.selectedProgram && $scope.model.selectedProgram.id ){

            EventService.getByOrgUnitAndProgram($scope.selectedOrgUnit.id,
            'DESCENDANTS',
            $scope.model.selectedProgram.id,
            $scope.model.optionSets,
            $scope.model.dataElements).then(function(events){
                $scope.model.faqs = events;
            });
        }
    };

    $scope.showFaqResponse = function( faq ){
        if ( $scope.model.selectedFaq && $scope.model.selectedFaq.event === faq.event ){
            $scope.model.showFaqResponse = !$scope.model.showFaqResponse;
            $scope.model.selectedFaq = null;
        }
        else{
            $scope.model.showFaqResponse = true;
            $scope.model.selectedFaq = faq;
        }
    };

    $scope.resetView = function(){
        $scope.model.selectedProgram = null;
    };
});
